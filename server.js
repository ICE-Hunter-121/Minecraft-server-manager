/**
 * Minecraft 服务器管理面板 - 完整生产版
 * 版本：4.0.0
 */

console.log('🚀 Minecraft 服务器管理面板启动中...');

// ==================== 模块导入 ====================
const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const WebSocket = require('ws');
const multer = require('multer');
const cors = require('cors');
const si = require('systeminformation');
const archiver = require('archiver');
const extract = require('extract-zip');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const iconv = require('iconv-lite');  // 添加iconv-lite库

// ==================== 配置 ====================
const PORT = process.env.PORT || 3002;
const SERVERS_BASE_DIR = path.join(__dirname, 'servers');
const BACKUP_DIR = path.join(__dirname, 'backups');
const SESSIONS_DIR = path.join(__dirname, 'sessions');

// 确保目录存在
[SERVERS_BASE_DIR, BACKUP_DIR, SESSIONS_DIR].forEach(dir => {
    if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
        console.log(`创建目录: ${dir}`);
    }
});

// ==================== Express 初始化 ====================
const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

// ==================== 账号互斥登录功能 ====================

// 存储用户登录状态
const activeUsers = new Map();

// 检查互斥账号
function checkMutexUsers(username) {
    const mutexPairs = {
        'yoko': 'ice',
        'ice': 'yoko'
    };
    
    const mutexUser = mutexPairs[username];
    if (mutexUser && activeUsers.has(mutexUser)) {
        return mutexUser;
    }
    return null;
}

// 踢出另一个用户
async function kickMutexUser(username) {
    const mutexUser = checkMutexUsers(username);
    if (mutexUser) {
        // 找到并关闭该用户的WebSocket连接
        wss.clients.forEach(client => {
            if (client.user === mutexUser && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'force_logout',
                    message: '您的账号已在其他地方登录'
                }));
                
                // 设置定时器关闭连接
                setTimeout(() => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.close();
                    }
                }, 3000);
            }
        });
        
        // 从activeUsers中移除
        activeUsers.delete(mutexUser);
        
        // 销毁session
        const sessionDir = path.join(SESSIONS_DIR);
        const files = await fs.readdir(sessionDir);
        
        for (const file of files) {
            if (file.startsWith('sess_')) {
                try {
                    const sessionPath = path.join(sessionDir, file);
                    const sessionData = await fs.readFile(sessionPath, 'utf8');
                    const session = JSON.parse(sessionData);
                    
                    if (session.user && session.user.username === mutexUser) {
                        await fs.unlink(sessionPath);
                        console.log(`已销毁 ${mutexUser} 的session: ${file}`);
                    }
                } catch (error) {
                    // 忽略解析错误
                }
            }
        }
        
        return mutexUser;
    }
    return null;
}

// Cookie解析函数
function parseCookies(cookieString) {
    const cookies = {};
    if (!cookieString) return cookies;
    
    cookieString.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        if (parts.length === 2) {
            cookies[parts[0].trim()] = parts[1].trim();
        }
    });
    
    return cookies;
}

// 中间件
app.use(cors());
app.use(express.json({ 
    limit: '2gb',  // JSON请求体限制为2GB
    parameterLimit: 1000000
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '2gb'  // URL编码请求体限制为2GB
}));
app.use(express.static(__dirname));

// Session 配置
app.use(session({
    store: new FileStore({ path: SESSIONS_DIR }),
    secret: 'minecraft-panel-secret-' + uuidv4(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ==================== Minecraft 服务器管理器 ====================
class MinecraftServerManager {
    constructor() {
        this.currentServer = null;
        this.serverProcess = null;
        this.serverStatus = {
            running: false,
            players: [],
            startTime: null,
            pid: null,
            tps: 20.0,
            memory: { used: 0, max: 1024 },
            cpu: 0,
            uptime: '0分钟',
            maxPlayers: 20
        };
        this.consoleOutput = [];
        this.maxConsoleLines = 1000;
        this.consoleEncoding = 'utf8';
    }

    // 添加一个函数来处理控制台输出的编码
    decodeConsoleOutput(data) {
        if (!data) return '';
        
        // 如果是Buffer，尝试解码
        if (Buffer.isBuffer(data)) {
            // 优先尝试UTF-8
            try {
                const utf8Text = iconv.decode(data, 'utf8');
                // 检查是否有乱码
                if (!utf8Text.includes('�')) {
                    return utf8Text;
                }
            } catch (error) {
                // UTF-8解码失败，继续尝试其他编码
            }
            
            // 尝试GBK（简体中文Windows常用编码）
            try {
                return iconv.decode(data, 'gbk');
            } catch (error) {
                // 尝试GB2312
                try {
                    return iconv.decode(data, 'gb2312');
                } catch (error) {
                    // 尝试其他常见编码
                    try {
                        return iconv.decode(data, 'big5');  // 繁体中文
                    } catch (error) {
                        try {
                            return iconv.decode(data, 'utf16le');
                        } catch (error) {
                            // 最后尝试使用原始Buffer的toString
                            return data.toString('utf8');
                        }
                    }
                }
            }
        }
        
        // 如果已经是字符串，直接返回
        return data.toString();
    }

    // 启动服务器
    async startServer(serverPath) {
        if (this.serverStatus.running) {
            return { success: false, message: '服务器已在运行中' };
        }

        try {
            // 检查 server.jar
            const serverJar = path.join(serverPath, 'server.jar');
            if (!fsSync.existsSync(serverJar)) {
                return { success: false, message: 'server.jar 不存在' };
            }

            // 读取 server.properties 获取端口
            const propertiesPath = path.join(serverPath, 'server.properties');
            let serverPort = 25565;
            if (fsSync.existsSync(propertiesPath)) {
                const properties = fsSync.readFileSync(propertiesPath, 'utf8');
                const portMatch = properties.match(/server-port=(\d+)/);
                if (portMatch) {
                    serverPort = parseInt(portMatch[1]);
                }
            }

            // 修改Java启动参数，添加编码参数
            const javaArgs = [
                '-Xmx4G',
                '-Xms2G',
                '-Dfile.encoding=UTF-8',  // 添加这行，指定文件编码为UTF-8
                '-Dconsole.encoding=UTF-8',  // 添加这行，指定控制台编码为UTF-8
                '-jar', 'server.jar',
                'nogui'
            ];

            console.log(`启动Minecraft服务器: ${serverPath}`);
            console.log(`端口: ${serverPort}`);
            console.log(`命令: java ${javaArgs.join(' ')}`);

            // 修改spawn配置
            this.serverProcess = spawn('java', javaArgs, {
                cwd: serverPath,
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true,  // 在Windows上隐藏子进程窗口
                encoding: 'utf8',   // 指定编码
                env: { 
                    ...process.env,
                    LANG: 'zh_CN.UTF-8',  // 设置语言环境
                    LC_ALL: 'zh_CN.UTF-8'  // 设置所有locale为UTF-8
                }
            });

            this.currentServer = serverPath;
            this.serverStatus = {
                running: true,
                startTime: new Date(),
                pid: this.serverProcess.pid,
                players: [],
                tps: 20.0,
                memory: { used: 0, max: 4096 },
                cpu: 0,
                uptime: '0分钟',
                maxPlayers: 20,
                port: serverPort
            };

            // 处理输出 - 使用解码函数
            this.serverProcess.stdout.on('data', (data) => {
                const decodedData = this.decodeConsoleOutput(data);
                this.processConsoleOutput(decodedData);
            });

            this.serverProcess.stderr.on('data', (data) => {
                const decodedData = this.decodeConsoleOutput(data);
                this.processConsoleOutput(`[ERROR] ${decodedData}`);
            });

            this.serverProcess.on('close', (code) => {
                console.log(`Minecraft服务器退出，代码 ${code}`);
                this.serverStatus.running = false;
                this.serverProcess = null;
                
                broadcast({
                    type: 'server_status',
                    data: { running: false }
                });
                
                this.processConsoleOutput(`[系统] 服务器已停止 (代码: ${code})`);
            });

            // 启动性能监控
            this.startPerformanceMonitoring();

            return { 
                success: true, 
                message: '服务器启动成功',
                pid: this.serverProcess.pid,
                port: serverPort
            };

        } catch (error) {
            console.error('启动服务器失败:', error);
            return { success: false, message: `启动失败: ${error.message}` };
        }
    }

    // 停止服务器
    async stopServer() {
        if (!this.serverStatus.running || !this.serverProcess) {
            return { success: false, message: '服务器未运行' };
        }

        try {
            // 发送停止命令
            this.sendCommand('stop');
            
            // 等待进程退出
            await new Promise((resolve) => {
                setTimeout(resolve, 5000);
            });

            return { success: true, message: '服务器停止命令已发送' };
        } catch (error) {
            console.error('停止服务器失败:', error);
            return { success: false, message: `停止失败: ${error.message}` };
        }
    }

    // 重启服务器
    async restartServer() {
        if (!this.serverStatus.running) {
            return this.startServer(this.currentServer);
        }

        const stopResult = await this.stopServer();
        if (!stopResult.success) {
            return stopResult;
        }

        // 等待10秒确保服务器完全停止
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        return this.startServer(this.currentServer);
    }

    // 发送命令
    sendCommand(command) {
        if (!this.serverStatus.running || !this.serverProcess) {
            return { success: false, message: '服务器未运行' };
        }

        try {
            this.serverProcess.stdin.write(command + '\n');
            this.processConsoleOutput(`[命令] ${command}`);
            return { success: true, message: '命令已发送' };
        } catch (error) {
            console.error('发送命令失败:', error);
            return { success: false, message: `发送失败: ${error.message}` };
        }
    }

    // 获取玩家列表
    async getPlayers() {
        if (!this.serverStatus.running) {
            return this.serverStatus.players;
        }

        // 发送 list 命令获取玩家列表
        this.sendCommand('list');
        
        // 返回缓存的玩家列表
        return this.serverStatus.players;
    }

    // 踢出玩家
    async kickPlayer(player, reason = '由管理员踢出') {
        if (!this.serverStatus.running) {
            return { success: false, message: '服务器未运行' };
        }

        return this.sendCommand(`kick ${player} ${reason}`);
    }

    // 授予OP权限
    async opPlayer(player) {
        if (!this.serverStatus.running) {
            return { success: false, message: '服务器未运行' };
        }

        return this.sendCommand(`op ${player}`);
    }

    // 处理控制台输出 - 改进编码处理
    processConsoleOutput(output) {
        let decodedOutput = '';
        
        // 尝试使用不同编码解码
        if (Buffer.isBuffer(output)) {
            // 尝试UTF-8解码
            try {
                decodedOutput = output.toString('utf8');
                // 检查是否有UTF-8替换字符
                if (decodedOutput.includes('�')) {
                    // 尝试GBK解码（常见的中文编码）
                    decodedOutput = iconv.decode(output, 'gbk');
                }
            } catch (error) {
                // 如果UTF-8解码失败，尝试GBK
                try {
                    decodedOutput = iconv.decode(output, 'gbk');
                } catch (e) {
                    // 如果都失败，使用原始Buffer的十六进制表示
                    decodedOutput = output.toString('hex');
                }
            }
        } else {
            // 如果已经是字符串，直接使用
            decodedOutput = output;
        }
        
        const lines = decodedOutput.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
            // 清理行尾的换行符和回车符
            line = line.replace(/\r$/, '').trim();
            if (!line) return;
            
            const timestamp = new Date().toLocaleTimeString('zh-CN');
            const consoleLine = `[${timestamp}] ${line}`;
            
            // 添加到控制台历史
            this.consoleOutput.push(consoleLine);
            if (this.consoleOutput.length > this.maxConsoleLines) {
                this.consoleOutput.shift();
            }

            // 解析玩家活动
            this.parsePlayerActivity(line);

            // 解析TPS
            this.parseTPS(line);

            // 广播到WebSocket
            broadcast({
                type: 'console_output',
                data: consoleLine
            });
        });
    }

    // 解析玩家活动
    parsePlayerActivity(line) {
        // 玩家加入
        const joinMatch = line.match(/(\w+)\s*(?:joined|加入).*游戏/);
        if (joinMatch) {
            const player = joinMatch[1];
            if (!this.serverStatus.players.includes(player)) {
                this.serverStatus.players.push(player);
                broadcast({
                    type: 'player_join',
                    data: { player, players: this.serverStatus.players }
                });
            }
        }

        // 玩家离开
        const leaveMatch = line.match(/(\w+)\s*(?:left|退出).*游戏/);
        if (leaveMatch) {
            const player = leaveMatch[1];
            this.serverStatus.players = this.serverStatus.players.filter(p => p !== player);
            broadcast({
                type: 'player_leave',
                data: { player, players: this.serverStatus.players }
            });
        }

        // list 命令输出
        if (line.includes('在线玩家') || line.includes('players online')) {
            const playersMatch = line.match(/(\w+(?:,\s*\w+)*)/);
            if (playersMatch) {
                const players = playersMatch[1].split(/,\s*/).filter(p => p);
                this.serverStatus.players = players;
                broadcast({
                    type: 'player_list',
                    data: players
                });
            }
        }
    }

    // 解析TPS
    parseTPS(line) {
        const tpsMatch = line.match(/TPS:\s*(\d+\.?\d*)/) || 
                        line.match(/tps:\s*(\d+\.?\d*)/i);
        if (tpsMatch) {
            const tps = parseFloat(tpsMatch[1]);
            if (!isNaN(tps)) {
                this.serverStatus.tps = tps;
                broadcast({
                    type: 'tps_update',
                    data: tps
                });
            }
        }
    }

    // 启动性能监控
    startPerformanceMonitoring() {
        const monitorInterval = setInterval(async () => {
            if (!this.serverStatus.running) {
                clearInterval(monitorInterval);
                return;
            }

            try {
                // 获取系统信息
                const [cpu, mem] = await Promise.all([
                    si.currentLoad(),
                    si.mem()
                ]);

                // 更新状态
                this.serverStatus.cpu = cpu.currentLoad.toFixed(1);
                this.serverStatus.memory = {
                    used: Math.round(mem.used / 1024 / 1024),
                    max: Math.round(mem.total / 1024 / 1024)
                };

                // 计算运行时间
                if (this.serverStatus.startTime) {
                    const uptimeMs = Date.now() - this.serverStatus.startTime;
                    const minutes = Math.floor(uptimeMs / 60000);
                    const hours = Math.floor(minutes / 60);
                    const days = Math.floor(hours / 24);
                    
                    let uptimeStr = '';
                    if (days > 0) uptimeStr += `${days}天`;
                    if (hours % 24 > 0) uptimeStr += `${hours % 24}小时`;
                    if (minutes % 60 > 0) uptimeStr += `${minutes % 60}分钟`;
                    if (!uptimeStr) uptimeStr = '0分钟';
                    
                    this.serverStatus.uptime = uptimeStr;
                }

                // 广播状态更新
                broadcast({
                    type: 'server_status',
                    data: { ...this.serverStatus }
                });

            } catch (error) {
                console.error('性能监控错误:', error);
            }
        }, 5000);
    }

    // 获取插件列表
    async getPlugins(serverPath) {
        try {
            const pluginsDir = path.join(serverPath, 'plugins');
            if (!fsSync.existsSync(pluginsDir)) {
                return [];
            }

            const files = await fs.readdir(pluginsDir);
            const plugins = [];

            for (const file of files) {
                if (file.endsWith('.jar')) {
                    const filePath = path.join(pluginsDir, file);
                    const stat = await fs.stat(filePath);
                    
                    plugins.push({
                        name: file.replace('.jar', ''),
                        filename: file,
                        size: this.formatFileSize(stat.size),
                        modified: stat.mtime,
                        enabled: !file.endsWith('.disabled')
                    });
                }
            }

            return plugins;
        } catch (error) {
            console.error('获取插件列表失败:', error);
            return [];
        }
    }

    // 启用插件
    async enablePlugin(serverPath, filename) {
        try {
            const pluginsDir = path.join(serverPath, 'plugins');
            const disabledFile = path.join(pluginsDir, filename + '.disabled');
            const enabledFile = path.join(pluginsDir, filename.replace('.disabled', ''));
            
            if (!fsSync.existsSync(disabledFile)) {
                return { success: false, message: '插件文件不存在' };
            }
            
            await fs.rename(disabledFile, enabledFile);
            return { success: true, message: '插件已启用' };
        } catch (error) {
            console.error('启用插件失败:', error);
            return { success: false, message: `启用失败: ${error.message}` };
        }
    }

    // 禁用插件
    async disablePlugin(serverPath, filename) {
        try {
            const pluginsDir = path.join(serverPath, 'plugins');
            const filePath = path.join(pluginsDir, filename);
            
            if (!fsSync.existsSync(filePath)) {
                return { success: false, message: '插件文件不存在' };
            }
            
            const disabledFile = filePath + '.disabled';
            await fs.rename(filePath, disabledFile);
            return { success: true, message: '插件已禁用' };
        } catch (error) {
            console.error('禁用插件失败:', error);
            return { success: false, message: `禁用失败: ${error.message}` };
        }
    }

    // 删除插件
    async deletePlugin(serverPath, filename) {
        try {
            const pluginsDir = path.join(serverPath, 'plugins');
            const filePath = path.join(pluginsDir, filename);
            
            if (!fsSync.existsSync(filePath)) {
                return { success: false, message: '插件文件不存在' };
            }
            
            await fs.unlink(filePath);
            return { success: true, message: '插件已删除' };
        } catch (error) {
            console.error('删除插件失败:', error);
            return { success: false, message: `删除失败: ${error.message}` };
        }
    }

    // 获取模组列表（修正版）
    async getMods(serverPath) {
        try {
            const modsDir = path.join(serverPath, 'mods');
            
            // 检查mods目录是否存在
            if (!fsSync.existsSync(modsDir)) {
                console.log(`模组目录不存在: ${modsDir}`);
                return [];
            }

            const files = await fs.readdir(modsDir);
            const mods = [];

            for (const file of files) {
                // 支持 .jar 和 .jar.disabled 文件
                if (file.endsWith('.jar') || file.endsWith('.jar.disabled')) {
                    const filePath = path.join(modsDir, file);
                    const stat = await fs.stat(filePath);
                    
                    // 提取模组名称（移除扩展名）
                    let modName = file;
                    if (modName.endsWith('.disabled')) {
                        modName = modName.replace('.disabled', '');
                    }
                    if (modName.endsWith('.jar')) {
                        modName = modName.replace('.jar', '');
                    }
                    
                    // 检查是否为禁用状态
                    const isEnabled = !file.endsWith('.disabled');
                    
                    mods.push({
                        name: modName,
                        filename: file,
                        size: this.formatFileSize(stat.size),
                        modified: stat.mtime,
                        enabled: isEnabled
                    });
                }
            }

            // 按文件名排序
            mods.sort((a, b) => a.name.localeCompare(b.name));
            
            console.log(`找到 ${mods.length} 个模组`);
            return mods;
        } catch (error) {
            console.error('获取模组列表失败:', error);
            return [];
        }
    }

    // 启用模组
    async enableMod(serverPath, filename) {
        try {
            const modsDir = path.join(serverPath, 'mods');
            const oldPath = path.join(modsDir, filename);
            const newPath = path.join(modsDir, filename.replace('.disabled', ''));
            
            if (!fsSync.existsSync(oldPath)) {
                return { success: false, message: '模组文件不存在' };
            }
            
            await fs.rename(oldPath, newPath);
            return { success: true, message: '模组已启用' };
        } catch (error) {
            console.error('启用模组失败:', error);
            return { success: false, message: `启用失败: ${error.message}` };
        }
    }

    // 禁用模组
    async disableMod(serverPath, filename) {
        try {
            const modsDir = path.join(serverPath, 'mods');
            const oldPath = path.join(modsDir, filename);
            const newPath = path.join(modsDir, filename + '.disabled');
            
            if (!fsSync.existsSync(oldPath)) {
                return { success: false, message: '模组文件不存在' };
            }
            
            await fs.rename(oldPath, newPath);
            return { success: true, message: '模组已禁用' };
        } catch (error) {
            console.error('禁用模组失败:', error);
            return { success: false, message: `禁用失败: ${error.message}` };
        }
    }

    // 删除模组
    async deleteMod(serverPath, filename) {
        try {
            const modsDir = path.join(serverPath, 'mods');
            const filePath = path.join(modsDir, filename);
            
            if (!fsSync.existsSync(filePath)) {
                return { success: false, message: '模组文件不存在' };
            }
            
            await fs.unlink(filePath);
            return { success: true, message: '模组已删除' };
        } catch (error) {
            console.error('删除模组失败:', error);
            return { success: false, message: `删除失败: ${error.message}` };
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 获取控制台输出
    getConsoleOutput(limit = 100) {
        return this.consoleOutput.slice(-limit);
    }

    // 获取服务器状态
    getStatus() {
        return { ...this.serverStatus };
    }
}

// 初始化服务器管理器
const serverManager = new MinecraftServerManager();

// ==================== WebSocket 广播函数 ====================
function broadcast(data) {
    // 确保数据中的字符串是UTF-8编码
    if (data.type === 'console_output') {
        // 对控制台输出进行编码检查
        if (typeof data.data === 'string') {
            // 转换为Buffer再转回字符串以确保UTF-8编码
            data.data = Buffer.from(data.data, 'utf8').toString('utf8');
        }
    }
    
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// ==================== 用户认证系统 ====================
const usersFilePath = path.join(__dirname, 'users.json');

class UserManager {
    constructor() {
        this.users = {};
        this.loadUsers();
    }

    async loadUsers() {
        try {
            if (fsSync.existsSync(usersFilePath)) {
                const data = await fs.readFile(usersFilePath, 'utf8');
                this.users = JSON.parse(data);
            } else {
                // 初始化默认用户
                const salt = bcrypt.genSaltSync(10);
                this.users = {
                    'admin': {
                        password: bcrypt.hashSync('admin', salt),
                        firstLogin: false,
                        role: 'admin',
                        displayName: '管理员',
                        lastLogin: null,
                        createdAt: new Date().toISOString()
                    },
                    'user': {
                        password: bcrypt.hashSync('password', salt),
                        firstLogin: true,
                        role: 'user',
                        displayName: '用户',
                        lastLogin: null,
                        createdAt: new Date().toISOString()
                    }
                };
                await this.saveUsers();
            }
        } catch (error) {
            console.error('加载用户数据失败:', error);
        }
    }

    async saveUsers() {
        try {
            await fs.writeFile(usersFilePath, JSON.stringify(this.users, null, 2));
        } catch (error) {
            console.error('保存用户数据失败:', error);
        }
    }

    authenticate(username, password) {
        const user = this.users[username];
        if (!user) return { success: false, message: '用户不存在' };
        
        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) return { success: false, message: '密码错误' };
        
        return { 
            success: true, 
            user: {
                username,
                displayName: user.displayName,
                role: user.role,
                firstLogin: user.firstLogin
            }
        };
    }

    async updatePassword(username, newPassword) {
        if (this.users[username]) {
            const salt = bcrypt.genSaltSync(10);
            this.users[username].password = bcrypt.hashSync(newPassword, salt);
            this.users[username].firstLogin = false;
            this.users[username].lastLogin = new Date().toISOString();
            await this.saveUsers();
            return { success: true };
        }
        return { success: false, message: '用户不存在' };
    }
}

const userManager = new UserManager();

// ==================== 认证中间件 ====================
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ success: false, error: '需要登录' });
    }
}

// ==================== 文件上传配置 ====================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fsSync.existsSync(uploadDir)) {
            fsSync.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 1024 * 1024 * 1024, // 1GB
        files: 10 // 最多10个文件
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            '.jar', '.zip', '.txt', '.properties', 
            '.yml', '.yaml', '.json', '.js', 
            '.dat', '.mca', '.nbt'
        ];
        
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'), false);
        }
    }
});

// ==================== WebSocket 连接处理 ====================
wss.on('connection', (ws, req) => {
    console.log('新的WebSocket连接');

    // 解析cookie获取session
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies['connect.sid'];

    // 发送当前服务器状态
    ws.send(JSON.stringify({
        type: 'server_status',
        data: serverManager.getStatus()
    }));

    // 发送最近的控制台输出
    const recentConsole = serverManager.getConsoleOutput(50);
    recentConsole.forEach(line => {
        ws.send(JSON.stringify({
            type: 'console_output',
            data: line
        }));
    });

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            // 用户认证消息
            if (data.type === 'auth') {
                const username = data.username;
                if (username) {
                    ws.user = username;
                    activeUsers.set(username, ws);
                    console.log(`用户 ${username} WebSocket认证成功`);
                }
            }
            
            switch(data.type) {
                case 'command':
                    if (data.command) {
                        const result = serverManager.sendCommand(data.command);
                        ws.send(JSON.stringify({
                            type: 'command_result',
                            success: result.success,
                            message: result.message
                        }));
                    }
                    break;
                    
                case 'get_status':
                    ws.send(JSON.stringify({
                        type: 'server_status',
                        data: serverManager.getStatus()
                    }));
                    break;
                    
                case 'get_console':
                    const consoleOutput = serverManager.getConsoleOutput(data.limit || 100);
                    ws.send(JSON.stringify({
                        type: 'console_history',
                        data: consoleOutput
                    }));
                    break;
            }
        } catch (error) {
            console.error('WebSocket消息处理错误:', error);
        }
    });
    
    ws.on('close', () => {
        if (ws.user) {
            activeUsers.delete(ws.user);
            console.log(`用户 ${ws.user} WebSocket连接关闭`);
        }
    });
    
    // 定期发送ping消息保持连接
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
        }
    }, 30000);
    
    ws.on('pong', () => {
        // 连接正常
    });
    
    ws.on('close', () => {
        clearInterval(pingInterval);
    });
});

// ==================== API 路由 ====================

// 用户认证
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    // 检查是否为互斥账号
    const mutexUser = checkMutexUsers(username);
    if (mutexUser) {
        return res.status(409).json({ 
            success: false, 
            message: `用户 ${mutexUser} 已在线，是否要强制登录？`,
            mutexUser: mutexUser,
            canForceLogin: true
        });
    }
    
    const result = userManager.authenticate(username, password);
    if (result.success) {
        req.session.user = result.user;
        
        // 添加到活跃用户列表
        activeUsers.set(username, {
            sessionId: req.sessionID,
            loginTime: new Date()
        });
        
        res.json({ 
            success: true, 
            user: result.user,
            firstLogin: result.user.firstLogin
        });
    } else {
        res.status(401).json({ success: false, message: result.message });
    }
});

// 强制登录API
app.post('/api/auth/force-login', async (req, res) => {
    const { username, password } = req.body;
    
    const result = userManager.authenticate(username, password);
    if (result.success) {
        // 踢出互斥用户
        const kickedUser = await kickMutexUser(username);
        
        req.session.user = result.user;
        
        // 添加到活跃用户列表
        activeUsers.set(username, {
            sessionId: req.sessionID,
            loginTime: new Date()
        });
        
        res.json({ 
            success: true, 
            user: result.user,
            firstLogin: result.user.firstLogin,
            kickedUser: kickedUser
        });
    } else {
        res.status(401).json({ success: false, message: result.message });
    }
});

// 获取在线用户列表
app.get('/api/auth/online-users', requireAuth, (req, res) => {
    const onlineUsers = Array.from(activeUsers.keys());
    res.json({
        success: true,
        onlineUsers: onlineUsers,
        count: onlineUsers.length
    });
});

app.post('/api/auth/logout', (req, res) => {
    if (req.session.user && req.session.user.username) {
        activeUsers.delete(req.session.user.username);
    }
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
    if (req.session.user) {
        res.json({ 
            success: true, 
            user: req.session.user 
        });
    } else {
        res.json({ success: false });
    }
});

app.post('/api/auth/change-password', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: '未登录' });
    }
    
    const { newPassword } = req.body;
    const result = await userManager.updatePassword(req.session.user.username, newPassword);
    
    if (result.success) {
        req.session.user.firstLogin = false;
        res.json({ success: true });
    } else {
        res.status(400).json(result);
    }
});

// 服务器操作
app.post('/api/server/start', requireAuth, async (req, res) => {
    try {
        const { serverPath } = req.body;
        const result = await serverManager.startServer(serverPath);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/server/stop', requireAuth, async (req, res) => {
    const result = await serverManager.stopServer();
    res.json(result);
});

app.post('/api/server/restart', requireAuth, async (req, res) => {
    const result = await serverManager.restartServer();
    res.json(result);
});

app.post('/api/server/command', requireAuth, (req, res) => {
    const { command } = req.body;
    const result = serverManager.sendCommand(command);
    res.json(result);
});

// 获取服务器状态
app.get('/api/server/status', requireAuth, (req, res) => {
    const status = serverManager.getStatus();
    res.json({ success: true, ...status });
});

// 玩家管理
app.get('/api/server/players', requireAuth, async (req, res) => {
    const players = await serverManager.getPlayers();
    res.json({ success: true, players });
});

app.post('/api/server/kick', requireAuth, async (req, res) => {
    const { player, reason } = req.body;
    const result = await serverManager.kickPlayer(player, reason);
    res.json(result);
});

app.post('/api/server/op', requireAuth, async (req, res) => {
    const { player } = req.body;
    const result = await serverManager.opPlayer(player);
    res.json(result);
});

// 控制台输出
app.get('/api/server/console', requireAuth, (req, res) => {
    const { limit = 100 } = req.query;
    const consoleOutput = serverManager.getConsoleOutput(parseInt(limit));
    res.json({ success: true, console: consoleOutput });
});

// 插件管理
app.get('/api/plugins', requireAuth, async (req, res) => {
    try {
        const { serverPath } = req.query;
        if (!serverPath) {
            return res.status(400).json({ success: false, message: '缺少服务器路径' });
        }
        
        const plugins = await serverManager.getPlugins(serverPath);
        res.json({ success: true, plugins });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 插件操作
app.post('/api/plugins/enable', requireAuth, async (req, res) => {
    try {
        const { serverPath, filename } = req.body;
        
        if (!serverPath || !filename) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }
        
        const result = await serverManager.enablePlugin(serverPath, filename);
        res.json(result);
        
    } catch (error) {
        console.error('启用插件API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: `服务器错误: ${error.message}` 
        });
    }
});

app.post('/api/plugins/disable', requireAuth, async (req, res) => {
    try {
        const { serverPath, filename } = req.body;
        
        if (!serverPath || !filename) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }
        
        const result = await serverManager.disablePlugin(serverPath, filename);
        res.json(result);
        
    } catch (error) {
        console.error('禁用插件API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: `服务器错误: ${error.message}` 
        });
    }
});

app.delete('/api/plugins/delete', requireAuth, async (req, res) => {
    try {
        const { serverPath, filename } = req.body;
        
        if (!serverPath || !filename) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }
        
        const result = await serverManager.deletePlugin(serverPath, filename);
        res.json(result);
        
    } catch (error) {
        console.error('删除插件API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: `服务器错误: ${error.message}` 
        });
    }
});

// 模组管理
app.get('/api/mods', requireAuth, async (req, res) => {
    try {
        const { serverPath } = req.query;
        
        if (!serverPath) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少服务器路径参数' 
            });
        }
        
        if (!fsSync.existsSync(serverPath)) {
            return res.status(404).json({ 
                success: false, 
                message: '服务器路径不存在' 
            });
        }
        
        const mods = await serverManager.getMods(serverPath);
        
        res.json({ 
            success: true, 
            mods: mods,
            count: mods.length
        });
        
    } catch (error) {
        console.error('获取模组列表API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: `服务器错误: ${error.message}` 
        });
    }
});

app.post('/api/mods/enable', requireAuth, async (req, res) => {
    try {
        const { serverPath, filename } = req.body;
        
        if (!serverPath || !filename) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少必要参数' 
            });
        }
        
        const result = await serverManager.enableMod(serverPath, filename);
        res.json(result);
        
    } catch (error) {
        console.error('启用模组API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: `服务器错误: ${error.message}` 
        });
    }
});

app.post('/api/mods/disable', requireAuth, async (req, res) => {
    try {
        const { serverPath, filename } = req.body;
        
        if (!serverPath || !filename) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少必要参数' 
            });
        }
        
        const result = await serverManager.disableMod(serverPath, filename);
        res.json(result);
        
    } catch (error) {
        console.error('禁用模组API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: `服务器错误: ${error.message}` 
        });
    }
});

app.delete('/api/mods/delete', requireAuth, async (req, res) => {
    try {
        const { serverPath, filename } = req.body;
        
        if (!serverPath || !filename) {
            return res.status(400).json({ 
                success: false, 
                message: '缺少必要参数' 
            });
        }
        
        const result = await serverManager.deleteMod(serverPath, filename);
        res.json(result);
        
    } catch (error) {
        console.error('删除模组API错误:', error);
        res.status(500).json({ 
            success: false, 
            message: `服务器错误: ${error.message}` 
        });
    }
});

// ==================== 文本文件编辑API ====================

// 辅助函数：格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取文件大小
app.get('/api/files/size', requireAuth, async (req, res) => {
    try {
        const { serverPath, filePath } = req.query;
        
        if (!serverPath || !filePath) {
            return res.status(400).json({ success: false, message: '缺少参数' });
        }
        
        const fullPath = path.join(serverPath, filePath);
        
        if (!fsSync.existsSync(fullPath)) {
            return res.status(404).json({ success: false, message: '文件不存在' });
        }
        
        const stat = await fs.stat(fullPath);
        
        res.json({
            success: true,
            size: stat.size,
            readableSize: formatFileSize(stat.size)
        });
        
    } catch (error) {
        console.error('获取文件大小失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 保存文本文件
app.post('/api/files/save', requireAuth, async (req, res) => {
    try {
        const { serverPath, filePath, content } = req.body;
        
        if (!serverPath || !filePath || content === undefined) {
            return res.status(400).json({ success: false, message: '缺少参数' });
        }
        
        const fullPath = path.join(serverPath, filePath);
        
        // 安全检查
        if (!fullPath.startsWith(serverPath)) {
            return res.status(403).json({ success: false, message: '访问被拒绝' });
        }
        
        // 创建备份（如果文件已存在）
        if (fsSync.existsSync(fullPath)) {
            const backupPath = fullPath + '.backup';
            await fs.copyFile(fullPath, backupPath);
        }
        
        // 保存文件
        await fs.writeFile(fullPath, content, 'utf8');
        
        res.json({ 
            success: true, 
            message: '文件保存成功',
            savedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('保存文件失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 文件管理
app.get('/api/files', requireAuth, async (req, res) => {
    try {
        const { path: filePath = '/' } = req.query;
        const { serverPath } = req.query;
        
        if (!serverPath) {
            return res.status(400).json({ success: false, message: '缺少服务器路径' });
        }
        
        const fullPath = path.join(serverPath, filePath);
        
        // 安全检查
        if (!fullPath.startsWith(serverPath)) {
            return res.status(403).json({ success: false, message: '访问被拒绝' });
        }
        
        if (!fsSync.existsSync(fullPath)) {
            return res.status(404).json({ success: false, message: '路径不存在' });
        }
        
        const stat = fsSync.statSync(fullPath);
        
        if (stat.isDirectory()) {
            const files = await fs.readdir(fullPath);
            const fileList = await Promise.all(files.map(async (file) => {
                const fileStat = await fs.stat(path.join(fullPath, file));
                return {
                    name: file,
                    type: fileStat.isDirectory() ? 'directory' : 'file',
                    size: fileStat.isDirectory() ? '-' : serverManager.formatFileSize(fileStat.size),
                    modified: fileStat.mtime,
                    permissions: fileStat.mode.toString(8)
                };
            }));
            
            res.json({ 
                success: true, 
                files: fileList,
                currentPath: filePath,
                isDirectory: true
            });
        } else {
            const content = await fs.readFile(fullPath, 'utf8');
            res.json({
                success: true,
                content: content,
                filename: path.basename(fullPath),
                currentPath: filePath,
                isDirectory: false
            });
        }
    } catch (error) {
        console.error('获取文件列表失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 上传文件
app.post('/api/files/upload', requireAuth, upload.array('files'), async (req, res) => {
    try {
        const { serverPath, targetPath = '/' } = req.body;
        
        if (!serverPath) {
            return res.status(400).json({ success: false, message: '缺少服务器路径' });
        }
        
        const fullTargetPath = path.join(serverPath, targetPath);
        
        // 确保目标目录存在
        if (!fsSync.existsSync(fullTargetPath)) {
            await fs.mkdir(fullTargetPath, { recursive: true });
        }
        
        // 移动上传的文件
        const uploadedFiles = [];
        for (const file of req.files) {
            const targetFile = path.join(fullTargetPath, file.originalname);
            await fs.rename(file.path, targetFile);
            uploadedFiles.push(file.originalname);
        }
        
        res.json({
            success: true,
            message: `成功上传 ${uploadedFiles.length} 个文件`,
            files: uploadedFiles
        });
    } catch (error) {
        console.error('上传文件失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 上传插件
app.post('/api/plugins/upload', requireAuth, upload.array('plugins'), async (req, res) => {
    try {
        const { serverPath } = req.body;
        
        if (!serverPath) {
            return res.status(400).json({ success: false, message: '缺少服务器路径' });
        }
        
        const pluginsDir = path.join(serverPath, 'plugins');
        
        // 确保插件目录存在
        if (!fsSync.existsSync(pluginsDir)) {
            await fs.mkdir(pluginsDir, { recursive: true });
        }
        
        // 移动上传的文件
        const uploadedFiles = [];
        for (const file of req.files) {
            const targetFile = path.join(pluginsDir, file.originalname);
            await fs.rename(file.path, targetFile);
            uploadedFiles.push(file.originalname);
        }
        
        res.json({
            success: true,
            message: `成功上传 ${uploadedFiles.length} 个插件`,
            files: uploadedFiles
        });
    } catch (error) {
        console.error('上传插件失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 上传模组
app.post('/api/mods/upload', requireAuth, upload.array('mods'), async (req, res) => {
    try {
        const { serverPath } = req.body;
        
        if (!serverPath) {
            return res.status(400).json({ success: false, message: '缺少服务器路径' });
        }
        
        const modsDir = path.join(serverPath, 'mods');
        
        // 确保模组目录存在
        if (!fsSync.existsSync(modsDir)) {
            await fs.mkdir(modsDir, { recursive: true });
        }
        
        // 移动上传的文件
        const uploadedFiles = [];
        for (const file of req.files) {
            const targetFile = path.join(modsDir, file.originalname);
            await fs.rename(file.path, targetFile);
            uploadedFiles.push(file.originalname);
        }
        
        res.json({
            success: true,
            message: `成功上传 ${uploadedFiles.length} 个模组`,
            files: uploadedFiles
        });
    } catch (error) {
        console.error('上传模组失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 重命名文件
app.post('/api/files/rename', requireAuth, async (req, res) => {
    try {
        const { serverPath, oldName, newName, currentPath = '/' } = req.body;
        
        if (!serverPath || !oldName || !newName) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }
        
        const fullOldPath = path.join(serverPath, currentPath, oldName);
        const fullNewPath = path.join(serverPath, currentPath, newName);
        
        if (!fsSync.existsSync(fullOldPath)) {
            return res.status(404).json({ success: false, message: '原文件不存在' });
        }
        
        if (fsSync.existsSync(fullNewPath)) {
            return res.status(400).json({ success: false, message: '新文件名已存在' });
        }
        
        await fs.rename(fullOldPath, fullNewPath);
        
        res.json({ success: true, message: '文件重命名成功' });
        
    } catch (error) {
        console.error('重命名文件失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 创建文件夹
app.post('/api/files/create-folder', requireAuth, async (req, res) => {
    try {
        const { serverPath, folderName, currentPath = '/' } = req.body;
        
        if (!serverPath || !folderName) {
            return res.status(400).json({ success: false, message: '缺少参数' });
        }
        
        const fullPath = path.join(serverPath, currentPath, folderName);
        
        if (fsSync.existsSync(fullPath)) {
            return res.status(400).json({ success: false, message: '文件夹已存在' });
        }
        
        await fs.mkdir(fullPath, { recursive: true });
        
        res.json({ success: true, message: '文件夹创建成功' });
        
    } catch (error) {
        console.error('创建文件夹失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 删除文件或文件夹
app.delete('/api/files/delete', requireAuth, async (req, res) => {
    try {
        const { serverPath, fileName, currentPath = '/', isDirectory = false } = req.body;
        
        if (!serverPath || !fileName) {
            return res.status(400).json({ success: false, message: '缺少参数' });
        }
        
        const fullPath = path.join(serverPath, currentPath, fileName);
        
        if (!fsSync.existsSync(fullPath)) {
            return res.status(404).json({ success: false, message: '文件不存在' });
        }
        
        if (isDirectory) {
            await fs.rm(fullPath, { recursive: true, force: true });
        } else {
            await fs.unlink(fullPath);
        }
        
        res.json({ success: true, message: '删除成功' });
        
    } catch (error) {
        console.error('删除文件失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 下载文件
app.get('/api/files/download', requireAuth, async (req, res) => {
    try {
        const { serverPath, filePath } = req.query;
        
        if (!serverPath || !filePath) {
            return res.status(400).json({ success: false, message: '缺少参数' });
        }
        
        const fullPath = path.join(serverPath, filePath);
        
        // 安全检查：确保文件在服务器目录内
        if (!fullPath.startsWith(serverPath)) {
            return res.status(403).json({ success: false, message: '访问被拒绝' });
        }
        
        if (!fsSync.existsSync(fullPath)) {
            return res.status(404).json({ success: false, message: '文件不存在' });
        }
        
        // 检查是否为文件（不是目录）
        const stat = fsSync.statSync(fullPath);
        if (stat.isDirectory()) {
            return res.status(400).json({ success: false, message: '不能下载文件夹' });
        }
        
        // 设置下载头
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        // 流式传输文件
        const fileStream = fsSync.createReadStream(fullPath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('下载文件失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 备份管理
app.get('/api/backups', requireAuth, async (req, res) => {
    try {
        if (!fsSync.existsSync(BACKUP_DIR)) {
            return res.json({ success: true, backups: [] });
        }
        
        const files = await fs.readdir(BACKUP_DIR);
        const backups = [];
        
        for (const file of files) {
            if (file.endsWith('.zip')) {
                const filePath = path.join(BACKUP_DIR, file);
                const stat = await fs.stat(filePath);
                
                backups.push({
                    name: file,
                    size: serverManager.formatFileSize(stat.size),
                    created: stat.ctime,
                    modified: stat.mtime,
                    path: filePath
                });
            }
        }
        
        // 按修改时间排序，最新的在前
        backups.sort((a, b) => b.modified - a.modified);
        
        res.json({ success: true, backups });
    } catch (error) {
        console.error('获取备份列表失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/backup/create', requireAuth, async (req, res) => {
    try {
        const { serverPath } = req.body;
        
        if (!serverPath) {
            return res.status(400).json({ success: false, message: '缺少服务器路径' });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const serverName = path.basename(serverPath);
        const backupName = `backup-${serverName}-${timestamp}.zip`;
        const backupPath = path.join(BACKUP_DIR, backupName);
        
        // 创建备份目录
        if (!fsSync.existsSync(BACKUP_DIR)) {
            await fs.mkdir(BACKUP_DIR, { recursive: true });
        }
        
        // 创建ZIP备份
        const output = fsSync.createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', () => {
            console.log(`备份创建完成: ${backupName} (${archive.pointer()} bytes)`);
            res.json({
                success: true,
                message: '备份创建成功',
                backup: {
                    name: backupName,
                    size: serverManager.formatFileSize(archive.pointer()),
                    path: backupPath
                }
            });
        });
        
        archive.on('error', (err) => {
            throw err;
        });
        
        archive.pipe(output);
        
        // 排除不需要备份的文件
        const excludePatterns = [
            '**/logs/**',
            '**/cache/**',
            '**/tmp/**',
            '**/*.log',
            '**/session.lock'
        ];
        
        archive.glob('**/*', {
            cwd: serverPath,
            ignore: excludePatterns
        });
        
        await archive.finalize();
        
    } catch (error) {
        console.error('创建备份失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/backup/restore', requireAuth, async (req, res) => {
    try {
        const { backupPath, serverPath } = req.body;
        
        if (!backupPath || !serverPath) {
            return res.status(400).json({ success: false, message: '缺少参数' });
        }
        
        // 停止服务器
        if (serverManager.getStatus().running) {
            await serverManager.stopServer();
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // 清空服务器目录（保留重要文件）
        const importantFiles = ['server.properties', 'whitelist.json', 'ops.json', 'banned-players.json', 'banned-ips.json'];
        
        const files = await fs.readdir(serverPath);
        for (const file of files) {
            if (!importantFiles.includes(file) && file !== 'server.jar') {
                const filePath = path.join(serverPath, file);
                const stat = await fs.stat(filePath);
                
                if (stat.isDirectory()) {
                    await fs.rm(filePath, { recursive: true, force: true });
                } else {
                    await fs.unlink(filePath);
                }
            }
        }
        
        // 解压备份
        await extract(backupPath, { dir: serverPath });
        
        res.json({ success: true, message: '备份恢复成功' });
    } catch (error) {
        console.error('恢复备份失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 系统信息
app.get('/api/system/info', requireAuth, async (req, res) => {
    try {
        const [cpu, mem, disk] = await Promise.all([
            si.cpu(),
            si.mem(),
            si.fsSize()
        ]);
        
        const systemInfo = {
            cpu: {
                manufacturer: cpu.manufacturer,
                brand: cpu.brand,
                cores: cpu.cores,
                speed: cpu.speed
            },
            memory: {
                total: Math.round(mem.total / 1024 / 1024),
                used: Math.round(mem.used / 1024 / 1024),
                free: Math.round(mem.free / 1024 / 1024),
                usage: ((mem.used / mem.total) * 100).toFixed(1)
            },
            disk: disk.map(d => ({
                fs: d.fs,
                size: Math.round(d.size / 1024 / 1024),
                used: Math.round(d.used / 1024 / 1024),
                use: d.use
            }))
        };
        
        res.json({ success: true, ...systemInfo });
    } catch (error) {
        console.error('获取系统信息失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== 服务器管理API ====================

// 从文件名提取版本号的辅助函数
function extractVersionFromFileName(fileName) {
    // 匹配常见的版本号格式: 1.16.5, 1.17, 1.18.2, 1.19.3等
    const versionMatch = fileName.match(/\d+\.\d+(?:\.\d+)?/);
    return versionMatch ? versionMatch[0] : 'Unknown';
}

// 获取JAR文件版本信息
async function getJarVersion(jarPath) {
    return new Promise((resolve, reject) => {
        exec(`jar tf "${jarPath}"`, (error, stdout, stderr) => {
            if (error) {
                // 如果无法读取JAR内容，尝试从文件名推断
                const fileName = path.basename(jarPath).toLowerCase();
                
                // 检查常见的服务器核心类型
                if (fileName.includes('paper') || fileName.includes('spigot') || fileName.includes('bukkit')) {
                    resolve({ 
                        type: 'Paper/Spigot', 
                        version: extractVersionFromFileName(fileName)
                    });
                } else if (fileName.includes('fabric')) {
                    resolve({ 
                        type: 'Fabric', 
                        version: extractVersionFromFileName(fileName)
                    });
                } else if (fileName.includes('forge')) {
                    resolve({ 
                        type: 'Forge', 
                        version: extractVersionFromFileName(fileName)
                    });
                } else if (fileName.includes('server')) {
                    resolve({ 
                        type: 'Vanilla', 
                        version: extractVersionFromFileName(fileName)
                    });
                } else {
                    // 尝试从文件名提取版本号
                    const version = extractVersionFromFileName(fileName);
                    resolve({
                        type: 'Custom',
                        version: version || 'Unknown'
                    });
                }
                return;
            }
            
            const output = stdout.toLowerCase();
            if (output.includes('spigot') || output.includes('paper')) {
                resolve({ 
                    type: 'Paper/Spigot', 
                    version: extractVersionFromFileName(path.basename(jarPath))
                });
            } else if (output.includes('fabric')) {
                resolve({ 
                    type: 'Fabric', 
                    version: extractVersionFromFileName(path.basename(jarPath))
                });
            } else if (output.includes('forge')) {
                resolve({ 
                    type: 'Forge', 
                    version: extractVersionFromFileName(path.basename(jarPath))
                });
            } else {
                // 尝试从文件名提取版本号
                const version = extractVersionFromFileName(path.basename(jarPath));
                resolve({
                    type: 'Vanilla',
                    version: version || 'Unknown'
                });
            }
        });
    });
}

// 获取所有服务器列表
app.get('/api/servers', requireAuth, async (req, res) => {
    try {
        const servers = [];
        
        if (fsSync.existsSync(SERVERS_BASE_DIR)) {
            const entries = await fs.readdir(SERVERS_BASE_DIR, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const serverPath = path.join(SERVERS_BASE_DIR, entry.name);
                    const hasJar = fsSync.existsSync(path.join(serverPath, 'server.jar'));
                    
                    if (hasJar) {
                        // 读取服务器属性
                        let serverPort = 25565;
                        let serverName = entry.name;
                        let maxPlayers = 20;
                        let version = 'Unknown';
                        
                        const propertiesPath = path.join(serverPath, 'server.properties');
                        if (fsSync.existsSync(propertiesPath)) {
                            const properties = await fs.readFile(propertiesPath, 'utf8');
                            const portMatch = properties.match(/server-port=(\d+)/);
                            const nameMatch = properties.match(/server-name=([^\n]+)/);
                            const maxPlayersMatch = properties.match(/max-players=(\d+)/);
                            
                            if (portMatch) serverPort = parseInt(portMatch[1]);
                            if (nameMatch) serverName = nameMatch[1].trim();
                            if (maxPlayersMatch) maxPlayers = parseInt(maxPlayersMatch[1]);
                        }
                        
                        // 获取版本信息
                        const jarPath = path.join(serverPath, 'server.jar');
                        try {
                            const jarInfo = await getJarVersion(jarPath);
                            version = jarInfo.version || 'Unknown';
                        } catch (error) {
                            console.error(`获取服务器版本失败 ${jarPath}:`, error);
                        }
                        
                        servers.push({
                            id: entry.name,
                            name: serverName,
                            path: serverPath,
                            port: serverPort,
                            maxPlayers: maxPlayers,
                            version: version,
                            hasServerJar: true,
                            created: (await fs.stat(serverPath)).ctime,
                            modified: (await fs.stat(serverPath)).mtime
                        });
                    } else {
                        // 没有server.jar的服务器
                        const propertiesPath = path.join(serverPath, 'server.properties');
                        let serverName = entry.name;
                        let serverPort = 25565;
                        let maxPlayers = 20;
                        
                        if (fsSync.existsSync(propertiesPath)) {
                            const properties = await fs.readFile(propertiesPath, 'utf8');
                            const nameMatch = properties.match(/server-name=([^\n]+)/);
                            const portMatch = properties.match(/server-port=(\d+)/);
                            const maxPlayersMatch = properties.match(/max-players=(\d+)/);
                            
                            if (nameMatch) serverName = nameMatch[1].trim();
                            if (portMatch) serverPort = parseInt(portMatch[1]);
                            if (maxPlayersMatch) maxPlayers = parseInt(maxPlayersMatch[1]);
                        }
                        
                        servers.push({
                            id: entry.name,
                            name: serverName,
                            path: serverPath,
                            port: serverPort,
                            maxPlayers: maxPlayers,
                            version: 'Unknown',
                            hasServerJar: false,
                            created: (await fs.stat(serverPath)).ctime,
                            modified: (await fs.stat(serverPath)).mtime
                        });
                    }
                }
            }
        }
        
        // 按修改时间排序，最新的在前
        servers.sort((a, b) => new Date(b.modified) - new Date(a.modified));
        
        res.json({ success: true, servers });
    } catch (error) {
        console.error('获取服务器列表失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 添加新服务器（创建空服务器）
app.post('/api/servers/add', requireAuth, async (req, res) => {
    try {
        const { name, type, version, port, maxPlayers } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: '服务器名称不能为空' });
        }
        
        // 生成服务器ID（使用安全的文件名）
        const serverId = name.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') + '-' + Date.now();
        
        const serverPath = path.join(SERVERS_BASE_DIR, serverId);
        
        // 检查是否已存在
        if (fsSync.existsSync(serverPath)) {
            return res.status(400).json({ 
                success: false, 
                message: '服务器已存在，请使用不同的名称' 
            });
        }
        
        // 创建服务器目录
        await fs.mkdir(serverPath, { recursive: true });
        
        // 创建服务器子目录
        await fs.mkdir(path.join(serverPath, 'plugins'), { recursive: true });
        await fs.mkdir(path.join(serverPath, 'mods'), { recursive: true });
        await fs.mkdir(path.join(serverPath, 'world'), { recursive: true });
        await fs.mkdir(path.join(serverPath, 'logs'), { recursive: true });
        
        // 创建server.properties
        const propertiesContent = `# Minecraft Server Properties
# Generated by Minecraft Panel
server-name=${name}
server-port=${port || 25565}
max-players=${maxPlayers || 20}
online-mode=true
white-list=false
enforce-whitelist=false
difficulty=easy
gamemode=survival
level-type=default
enable-command-block=false
max-tick-time=60000
enable-rcon=false
rcon.port=25575
rcon.password=
view-distance=10
simulation-distance=10
motd=${name} - Managed by Minecraft Panel
hardcore=false
pvp=true
spawn-protection=16
max-world-size=29999984
`;
        
        await fs.writeFile(
            path.join(serverPath, 'server.properties'),
            propertiesContent
        );
        
        // 创建eula.txt（自动同意）
        const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).
#Generated by Minecraft Panel
eula=true
`;
        
        await fs.writeFile(
            path.join(serverPath, 'eula.txt'),
            eulaContent
        );
        
        // 创建启动脚本（Windows）
        const startScript = `@echo off
echo Starting Minecraft Server...
java -Xms2G -Xmx4G -jar server.jar nogui
pause
`;
        
        await fs.writeFile(
            path.join(serverPath, 'start.bat'),
            startScript
        );
        
        // 创建启动脚本（Linux）
        const startScriptLinux = `#!/bin/bash
echo "Starting Minecraft Server..."
java -Xms2G -Xmx4G -jar server.jar nogui
`;
        
        await fs.writeFile(
            path.join(serverPath, 'start.sh'),
            startScriptLinux
        );
        
        // 设置执行权限（Linux）
        await fs.chmod(path.join(serverPath, 'start.sh'), 0o755);
        
        // 创建默认的world目录结构
        const worldDir = path.join(serverPath, 'world');
        await fs.mkdir(path.join(worldDir, 'datapacks'), { recursive: true });
        await fs.mkdir(path.join(worldDir, 'playerdata'), { recursive: true });
        await fs.mkdir(path.join(worldDir, 'region'), { recursive: true });
        await fs.mkdir(path.join(worldDir, 'stats'), { recursive: true });
        
        res.json({
            success: true,
            message: '服务器创建成功',
            server: {
                id: serverId,
                name: name,
                path: serverPath,
                port: port || 25565,
                maxPlayers: maxPlayers || 20,
                hasServerJar: false,
                version: version || 'Unknown',
                created: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('添加服务器失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 上传server.jar文件
app.post('/api/servers/upload-jar', requireAuth, upload.single('serverJar'), async (req, res) => {
    try {
        const { serverId } = req.body;
        
        if (!serverId) {
            return res.status(400).json({ success: false, message: '缺少服务器ID' });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: '未上传JAR文件' });
        }
        
        const serverPath = path.join(SERVERS_BASE_DIR, serverId);
        
        if (!fsSync.existsSync(serverPath)) {
            // 删除上传的临时文件
            await fs.unlink(req.file.path);
            return res.status(404).json({ success: false, message: '服务器不存在' });
        }
        
        // 获取原始文件名
        const originalName = req.file.originalname;
        
        // 移动JAR文件到服务器目录，并重命名为server.jar
        const targetPath = path.join(serverPath, 'server.jar');
        
        // 如果已存在server.jar，先删除
        if (fsSync.existsSync(targetPath)) {
            await fs.unlink(targetPath);
        }
        
        await fs.rename(req.file.path, targetPath);
        
        // 获取JAR版本信息
        let versionInfo = { type: 'Unknown', version: 'Unknown' };
        try {
            versionInfo = await getJarVersion(targetPath);
        } catch (error) {
            console.error('获取JAR版本失败:', error);
        }
        
        res.json({
            success: true,
            message: `JAR文件上传成功 (${originalName})`,
            server: {
                id: serverId,
                path: serverPath,
                hasServerJar: true,
                version: versionInfo.version,
                type: versionInfo.type,
                originalFileName: originalName
            }
        });
        
    } catch (error) {
        console.error('上传JAR文件失败:', error);
        
        // 清理临时文件
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('清理临时文件失败:', unlinkError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            message: `上传失败: ${error.message}` 
        });
    }
});

// 删除服务器
app.delete('/api/servers/delete', requireAuth, async (req, res) => {
    try {
        const { serverId } = req.body;
        
        if (!serverId) {
            return res.status(400).json({ success: false, message: '缺少服务器ID' });
        }
        
        const serverPath = path.join(SERVERS_BASE_DIR, serverId);
        
        if (!fsSync.existsSync(serverPath)) {
            return res.status(404).json({ success: false, message: '服务器不存在' });
        }
        
        // 检查服务器是否在运行
        const currentServerPath = serverManager.currentServer;
        if (serverManager.getStatus().running && currentServerPath === serverPath) {
            return res.status(400).json({ 
                success: false, 
                message: '请先停止服务器再删除' 
            });
        }
        
        // 删除服务器目录
        await fs.rm(serverPath, { recursive: true, force: true });
        
        res.json({ 
            success: true, 
            message: '服务器删除成功' 
        });
        
    } catch (error) {
        console.error('删除服务器失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 检查服务器JAR状态
app.get('/api/servers/check-jar', requireAuth, async (req, res) => {
    try {
        const { serverId } = req.query;
        
        if (!serverId) {
            return res.status(400).json({ success: false, message: '缺少服务器ID' });
        }
        
        const serverPath = path.join(SERVERS_BASE_DIR, serverId);
        const jarPath = path.join(serverPath, 'server.jar');
        
        const exists = fsSync.existsSync(jarPath);
        let version = 'Unknown';
        let type = 'Unknown';
        
        if (exists) {
            try {
                const versionInfo = await getJarVersion(jarPath);
                version = versionInfo.version;
                type = versionInfo.type;
            } catch (error) {
                console.error('获取版本失败:', error);
            }
        }
        
        res.json({
            success: true,
            hasJar: exists,
            version: version,
            type: type
        });
        
    } catch (error) {
        console.error('检查JAR状态失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 下载Minecraft服务器JAR
app.get('/api/servers/download-jar', requireAuth, async (req, res) => {
    try {
        const { version = 'latest', type = 'vanilla' } = req.query;
        
        res.json({
            success: false,
            message: '在线下载功能开发中，请手动上传server.jar文件',
            info: {
                version: version,
                type: type,
                officialUrl: 'https://www.minecraft.net/en-us/download/server'
            }
        });
        
    } catch (error) {
        console.error('下载JAR失败:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== 静态文件路由 ====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/change-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'change-password.html'));
});

// ==================== 启动服务器 ====================
server.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('✅ Minecraft 服务器管理面板');
    console.log('='.repeat(60));
    console.log(`📡 HTTP 服务器: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket 服务器: ws://localhost:${PORT}`);
    console.log(`📁 服务器目录: ${SERVERS_BASE_DIR}`);
    console.log(`💾 备份目录: ${BACKUP_DIR}`);
    console.log('='.repeat(60));
    console.log('等待连接...');
    console.log('默认用户: admin / admin');
    console.log('测试用户: user / password');
    console.log('互斥用户: yoko 和 ice 不能同时在线');
});

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n正在关闭服务器...');
    
    if (serverManager.getStatus().running) {
        await serverManager.stopServer();
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    wss.close(() => {
        console.log('WebSocket服务器已关闭');
        process.exit(0);
    });
});