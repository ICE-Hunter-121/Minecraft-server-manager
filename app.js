/**
 * Minecraft 服务器管理面板 - 完整前端
 * 版本：4.0.0
 */

// ==================== 全局变量 ====================
let currentPage = 'dashboard';
let currentServer = null;
let servers = [];
let ws = null;
let serverStatus = null;
let consoleOutput = [];

// ==================== 主初始化函数 ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 前端应用初始化...');
    
    // 设置导航
    setupNavigation();
    
    // 检查登录状态
    checkLoginStatus();
    
    // 加载服务器列表
    loadServers();
    
    // 初始化WebSocket
    initWebSocket();
    
    // 加载默认页面
    setTimeout(() => {
        console.log('加载默认页面:', currentPage);
        loadPage(currentPage);
    }, 100);
    
    // 定期更新状态
    setInterval(updateStatusBar, 5000);
    
    // 全局函数导出
    window.loadPage = loadPage;
    window.startServer = startServer;
    window.stopServer = stopServer;
    window.restartServer = restartServer;
    window.sendConsoleCommand = sendConsoleCommand;
    window.clearConsole = clearConsole;
    window.sendCommand = sendCommand;
    window.kickPlayer = kickPlayer;
    window.opPlayer = opPlayer;
    window.kickPlayerByName = kickPlayerByName;
    window.opPlayerByName = opPlayerByName;
    window.sendMessageToPlayer = sendMessageToPlayer;
    window.createBackup = createBackup;
    window.refreshServerStatus = refreshServerStatus;
    window.showNotification = showNotification;
    
    // 服务器管理相关函数导出
    window.refreshServerList = refreshServerList;
    window.selectServer = selectServer;
    window.showAddServerModal = showAddServerModal;
    window.addNewServer = addNewServer;
    window.uploadServerJar = uploadServerJar;
    window.clearServerJarSelection = clearServerJarSelection;
    window.uploadServerJarFile = uploadServerJarFile;
    window.deleteServer = deleteServer;
    
    // 模组管理相关函数导出
    window.showUploadModModal = showUploadModModal;
    window.closeModal = closeModal;
    window.uploadMods = uploadMods;
    window.refreshModList = refreshModList;
    window.enableMod = enableMod;
    window.disableMod = disableMod;
    window.deleteMod = deleteMod;
    window.handleDragOver = handleDragOver;
    window.handleDragLeave = handleDragLeave;
    window.handleModDrop = handleModDrop;
    window.removeModFile = removeModFile;
    
    // 插件相关函数导出
    window.showUploadPluginModal = showUploadPluginModal;
    window.closePluginModal = closePluginModal;
    window.openPluginFileDialog = openPluginFileDialog;
    window.removePluginFile = removePluginFile;
    window.uploadPluginFiles = uploadPluginFiles;
    window.refreshPluginList = refreshPluginList;
    window.enablePlugin = enablePlugin;
    window.disablePlugin = disablePlugin;
    window.deletePlugin = deletePlugin;
    window.enableAllPlugins = enableAllPlugins;
    window.disableAllPlugins = disableAllPlugins;
    window.reloadAllPlugins = reloadAllPlugins;
    
    // 服务器创建相关函数导出
    window.closeServerModal = closeServerModal;
    window.openJarFileDialog = openJarFileDialog;
    window.closeUploadJarModal = closeUploadJarModal;
    
    // 文件管理相关函数导出
    window.navigateToPath = navigateToPath;
    window.viewFile = viewFile;
    window.downloadFile = downloadFile;
    window.renameFile = renameFile;
    window.deleteFile = deleteFile;
    window.selectAllFiles = selectAllFiles;
    window.deselectAllFiles = deselectAllFiles;
    window.toggleSelectAll = toggleSelectAll;
    window.deleteSelectedFiles = deleteSelectedFiles;
    window.downloadSelectedFiles = downloadSelectedFiles;
    window.refreshFileList = refreshFileList;
    window.showCreateFolderModal = showCreateFolderModal;
    window.showFileUploadModal = showFileUploadModal;
    window.handleFileSelection = handleFileSelection;
    window.removeFileFromList = removeFileFromList;
    window.getFileIcon = getFileIcon;
    window.uploadSelectedFiles = uploadSelectedFiles;
    window.createFolder = createFolder;
    window.escapeHtml = escapeHtml;
    
    // 文本编辑器相关函数导出
    window.openTextEditor = openTextEditor;
    window.saveTextFile = saveTextFile;
    window.downloadTextFile = downloadTextFile;
    window.showEditorSettings = showEditorSettings;
    window.updateEditorFontSize = updateEditorFontSize;
    window.updateEditorTheme = updateEditorTheme;
    window.toggleLineNumbers = toggleLineNumbers;
    window.viewBinaryFile = viewBinaryFile;
    
    // 新增的编辑器功能导出
    window.showTextEditorModal = showTextEditorModal;
    window.updateEditorFontFamily = updateEditorFontFamily;
    window.updateTabSize = updateTabSize;
    window.toggleWhitespace = toggleWhitespace;
    window.toggleWordWrap = toggleWordWrap;
    window.saveEditorSettings = saveEditorSettings;
    window.resetEditorSettings = resetEditorSettings;
    window.loadEditorSettings = loadEditorSettings;
    window.updateEditorStats = updateEditorStats;
    window.setupEditorState = setupEditorState;
    
    // 登录相关函数导出
    window.forceLogin = forceLogin;
    
    console.log('✅ 前端应用初始化完成');
});

// ==================== 用户认证 ====================
async function checkLoginStatus() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        const loginBtn = document.getElementById('loginBtn');
        const userInfo = document.getElementById('userInfo');
        const usernameSpan = document.getElementById('username');
        
        if (data.success && data.user) {
            loginBtn.style.display = 'none';
            userInfo.style.display = 'flex';
            usernameSpan.textContent = data.user.displayName;
            
            // 如果是第一次登录，跳转到修改密码页面
            if (data.user.firstLogin) {
                window.location.href = '/change-password';
            }
        } else {
            loginBtn.style.display = 'block';
            userInfo.style.display = 'none';
        }
    } catch (error) {
        console.error('检查登录状态失败:', error);
        showNotification('无法连接认证服务', 'error');
    }
}

// ==================== 服务器管理 ====================
async function loadServers() {
    try {
        const response = await fetch('/api/servers');
        const data = await response.json();
        
        if (data.success) {
            servers = data.servers;
            
            // 更新服务器选择器
            updateServerSelector(servers);
            
            // 如果没有当前服务器，选择第一个
            if (!currentServer && servers.length > 0) {
                currentServer = servers[0];
                updateCurrentServerInfo();
            }
        }
    } catch (error) {
        console.error('加载服务器列表失败:', error);
    }
}

function updateServerSelector(serverList) {
    const serverSelect = document.getElementById('serverSelect');
    if (!serverSelect) return;
    
    serverSelect.innerHTML = '<option value="">选择服务器...</option>';
    
    serverList.forEach(server => {
        const option = document.createElement('option');
        option.value = server.id;
        option.textContent = server.name;
        option.dataset.path = server.path;
        
        if (currentServer && server.id === currentServer.id) {
            option.selected = true;
        }
        
        serverSelect.appendChild(option);
    });
    
    // 添加事件监听
    serverSelect.addEventListener('change', function() {
        const selectedId = this.value;
        const selectedServer = servers.find(s => s.id === selectedId);
        
        if (selectedServer) {
            currentServer = selectedServer;
            updateCurrentServerInfo();
            
            // 重新加载当前页面
            if (currentPage) {
                loadPage(currentPage);
            }
        }
    });
}

function updateCurrentServerInfo() {
    if (!currentServer) return;
    
    const serverNameElement = document.getElementById('currentServerName');
    if (serverNameElement) {
        serverNameElement.textContent = currentServer.name;
    }
}

// ==================== WebSocket 连接 ====================
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;
    
    console.log('连接WebSocket:', wsUrl);
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        console.log('✅ WebSocket连接成功');
        showNotification('实时连接已建立', 'success');
        updateConnectionStatus('connected');
        
        // 如果已登录，发送认证消息
        const username = getCurrentUsername();
        if (username) {
            ws.send(JSON.stringify({
                type: 'auth',
                username: username
            }));
        }
    };
    
    ws.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    };
    
    ws.onclose = function(event) {
        console.log('WebSocket连接关闭:', event.code, event.reason);
        showNotification('实时连接已断开', 'warning');
        updateConnectionStatus('disconnected');
        
        // 5秒后尝试重连
        setTimeout(initWebSocket, 5000);
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket错误:', error);
        updateConnectionStatus('error');
    };
}

function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    const statusText = {
        connected: '已连接',
        disconnected: '已断开',
        error: '连接错误'
    };
    
    const statusClass = {
        connected: 'online',
        disconnected: 'offline',
        error: 'offline'
    };
    
    statusElement.textContent = statusText[status] || status;
    
    // 更新底部状态栏
    const footerStatus = document.getElementById('footerConnectionStatus');
    if (footerStatus) {
        footerStatus.textContent = statusText[status] || status;
    }
    
    // 更新侧边栏状态点
    const statusDot = document.getElementById('sidebarStatusDot');
    if (statusDot) {
        statusDot.className = `status-dot ${statusClass[status] || 'offline'}`;
    }
}

function handleWebSocketMessage(data) {
    switch(data.type) {
        case 'server_status':
            serverStatus = data.data;
            updateDashboardStats();
            if (window.updateServerStatus) {
                window.updateServerStatus(serverStatus);
            }
            break;
            
        case 'console_output':
            appendConsoleOutput(data.data);
            break;
            
        case 'console_history':
            consoleOutput = data.data;
            refreshConsoleOutput();
            break;
            
        case 'player_join':
        case 'player_leave':
        case 'player_list':
            if (currentPage === 'players' || currentPage === 'dashboard') {
                updatePlayerList(data.data);
            }
            break;
            
        case 'tps_update':
            if (serverStatus) {
                serverStatus.tps = data.data;
                updateTPSDisplay();
            }
            break;
            
        case 'command_result':
            if (!data.success) {
                showNotification(data.message, 'error');
            }
            break;
            
        case 'force_logout':
            showNotification(data.message, 'warning');
            
            // 显示强制下线模态框
            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-exclamation-triangle text-warning"></i> 账号已在其他地方登录</h3>
                    </div>
                    <div class="modal-body">
                        <div class="text-center p-4">
                            <i class="fas fa-user-slash text-4xl text-warning mb-4"></i>
                            <p class="text-lg mb-2">您的账号已在其他地方登录</p>
                            <p class="text-gray-400">如果这不是您的操作，请立即修改密码</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="window.location.reload()">
                            重新登录
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // 自动重定向到登录页面
            setTimeout(() => {
                window.location.href = '/login';
            }, 5000);
            break;
    }
}

// ==================== 页面导航 ====================
function setupNavigation() {
    // 事件委托到整个文档
    document.addEventListener('click', function(event) {
        let target = event.target;
        
        // 向上查找包含 data-page 属性的元素
        while (target && target !== document) {
            if (target.hasAttribute('data-page')) {
                event.preventDefault();
                event.stopPropagation();
                
                const pageName = target.getAttribute('data-page');
                if (pageName && pageName !== currentPage) {
                    console.log(`导航到: ${pageName}`);
                    loadPage(pageName);
                    updateActiveNav(target);
                }
                return;
            }
            target = target.parentElement;
        }
    });
    
    // 处理浏览器前进后退
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.page) {
            loadPage(event.state.page);
        }
    });
}

function updateActiveNav(activeElement) {
    // 移除所有active类
    document.querySelectorAll('.nav-link, [data-page]').forEach(el => {
        el.classList.remove('active');
        if (el.parentElement) {
            el.parentElement.classList.remove('active');
        }
    });
    
    // 添加active类到当前元素
    activeElement.classList.add('active');
    if (activeElement.parentElement) {
        activeElement.parentElement.classList.add('active');
    }
}

// ==================== 页面加载 ====================
async function loadPage(pageName) {
    console.log(`加载页面: ${pageName}`);
    
    // 更新当前页面
    currentPage = pageName;
    
    // 更新浏览器历史
    window.history.pushState({ page: pageName }, pageName, `#${pageName}`);
    
    // 显示加载状态
    const contentArea = document.getElementById('main-content');
    if (!contentArea) {
        console.error('找不到内容区域: #main-content');
        return;
    }
    
    contentArea.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <div class="loading-text">正在加载 ${getPageTitle(pageName)}...</div>
        </div>
    `;
    
    try {
        let html = '';
        
        switch(pageName) {
            case 'dashboard':
                html = await loadDashboardPage();
                break;
            case 'console':
                html = await loadConsolePage();
                break;
            case 'players':
                html = await loadPlayersPage();
                break;
            case 'plugins':
                html = await loadPluginsPage();
                break;
            case 'mods':
                html = await loadModsPage();
                break;
            case 'files':
                html = await loadFilesPage();
                break;
            case 'backups':
                html = await loadBackupsPage();
                break;
            case 'servers':
                html = await loadServersPage();
                break;
            case 'settings':
                html = await loadSettingsPage();
                break;
            default:
                html = await loadDashboardPage();
        }
        
        contentArea.innerHTML = html;
        
        // 初始化页面特定功能
        initializePageFunctions(pageName);
        
    } catch (error) {
        console.error(`加载页面 ${pageName} 失败:`, error);
        contentArea.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle empty-icon"></i>
                <h3 class="empty-title">加载失败</h3>
                <p class="empty-description">无法加载 ${pageName} 页面</p>
                <button class="btn btn-primary" onclick="loadPage('dashboard')">
                    返回仪表板
                </button>
            </div>
        `;
    }
}

function getPageTitle(pageName) {
    const titles = {
        dashboard: '状态监控',
        console: '服务器控制台',
        players: '玩家管理',
        plugins: '插件管理',
        mods: '模组管理',
        files: '文件管理',
        backups: '备份管理',
        servers: '服务器管理',
        settings: '系统设置'
    };
    return titles[pageName] || pageName;
}

// ==================== 页面内容 ====================

// 仪表板页面
async function loadDashboardPage() {
    // 获取服务器状态
    let status = serverStatus;
    if (!status) {
        try {
            const response = await fetch('/api/server/status');
            const data = await response.json();
            if (data.success) {
                status = data;
            }
        } catch (error) {
            console.error('获取服务器状态失败:', error);
        }
    }
    
    return `
        <div class="content-header">
            <h2 class="page-title"><i class="fas fa-tachometer-alt"></i> 状态监控</h2>
            <div class="content-actions">
                ${currentServer ? `
                    <button onclick="refreshServerStatus()" class="btn btn-sm btn-outline">
                        <i class="fas fa-redo"></i> 刷新状态
                    </button>
                ` : ''}
            </div>
        </div>
        
        ${!currentServer ? `
            <div class="card">
                <div class="card-body">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle empty-icon"></i>
                        <h3 class="empty-title">未选择服务器</h3>
                        <p class="empty-description">请从右上角选择器选择一个服务器，或添加新服务器。</p>
                        <button onclick="loadPage('servers')" class="btn btn-primary">
                            <i class="fas fa-server"></i> 管理服务器
                        </button>
                    </div>
                </div>
            </div>
        ` : `
            <div class="dashboard-grid">
                <!-- 服务器状态卡片 -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-server"></i> 服务器状态</h3>
                        <span class="status-dot ${status?.running ? 'online' : 'offline'}">
                            ${status?.running ? '运行中' : '已停止'}
                        </span>
                    </div>
                    <div class="card-body">
                        <div class="status-info">
                            <div class="mb-3">
                                <div class="text-muted">服务器名称</div>
                                <div class="text-lg font-bold">${currentServer.name}</div>
                            </div>
                            <div class="mb-3">
                                <div class="text-muted">运行时间</div>
                                <div class="text-lg">${status?.uptime || '0分钟'}</div>
                            </div>
                            <div class="mb-3">
                                <div class="text-muted">在线玩家</div>
                                <div class="text-lg">
                                    ${status?.players?.length || 0} / ${currentServer.maxPlayers || 20}
                                </div>
                            </div>
                            <div class="mb-3">
                                <div class="text-muted">TPS</div>
                                <div class="text-lg" id="tpsValue">${status?.tps || '20.0'}</div>
                            </div>
                        </div>
                        <div class="flex gap-2 mt-4">
                            ${status?.running ? `
                                <button onclick="stopServer()" class="btn btn-danger">
                                    <i class="fas fa-stop"></i> 停止服务器
                                </button>
                            ` : `
                                <button onclick="startServer()" class="btn btn-success">
                                    <i class="fas fa-play"></i> 启动服务器
                                </button>
                            `}
                            <button onclick="restartServer()" class="btn btn-warning">
                                <i class="fas fa-redo"></i> 重启服务器
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 系统监控卡片 -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-chart-line"></i> 系统监控</h3>
                    </div>
                    <div class="card-body">
                        <div class="monitor-grid">
                            <div class="mb-4">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="fas fa-microchip"></i>
                                    <span>CPU使用率</span>
                                </div>
                                <div class="text-xl font-bold" id="cpu-usage">${status?.cpu || '0'}%</div>
                                <div class="progress-bar mt-2">
                                    <div class="progress-fill" style="width: ${status?.cpu || 0}%"></div>
                                </div>
                            </div>
                            <div class="mb-4">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="fas fa-memory"></i>
                                    <span>内存使用</span>
                                </div>
                                <div class="text-xl font-bold" id="mem-usage">${status?.memory?.used || 0} MB</div>
                                <div class="progress-bar mt-2">
                                    <div class="progress-fill" 
                                         style="width: ${status?.memory?.used && status?.memory?.max ? 
                                                (status.memory.used / status.memory.max * 100) : 0}%">
                                    </div>
                                </div>
                            </div>
                            <div class="mb-4">
                                <div class="flex items-center gap-2 mb-1">
                                    <i class="fas fa-hdd"></i>
                                    <span>硬盘使用</span>
                                </div>
                                <div class="text-xl font-bold" id="disk-usage">${status?.disk || '0%'}</div>
                                <div class="progress-bar mt-2">
                                    <div class="progress-fill" style="width: ${status?.disk?.replace('%', '') || 0}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 在线玩家卡片 -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-users"></i> 在线玩家</h3>
                        <span class="badge">${status?.players?.length || 0}</span>
                    </div>
                    <div class="card-body">
                        ${status?.players && status.players.length > 0 ? `
                            <div class="players-list">
                                ${status.players.map(player => `
                                    <div class="flex items-center justify-between py-2 border-b border-gray-700">
                                        <div class="flex items-center gap-2">
                                            <i class="fas fa-user"></i>
                                            <span>${player}</span>
                                        </div>
                                        <div class="flex gap-2">
                                            <button onclick="kickPlayer('${player}')" class="btn btn-sm btn-danger">
                                                <i class="fas fa-user-slash"></i> 踢出
                                            </button>
                                            <button onclick="opPlayer('${player}')" class="btn btn-sm btn-success">
                                                <i class="fas fa-crown"></i> OP
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="empty-state py-8">
                                <i class="fas fa-user-slash empty-icon"></i>
                                <p class="empty-description">暂无在线玩家</p>
                            </div>
                        `}
                        <div class="mt-4">
                            <button onclick="loadPage('players')" class="btn btn-sm btn-outline w-full">
                                <i class="fas fa-users"></i> 管理玩家
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 快速操作卡片 -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-bolt"></i> 快速操作</h3>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <button onclick="loadPage('console')" class="btn btn-outline flex flex-col items-center justify-center p-4">
                                <i class="fas fa-terminal text-xl mb-2"></i>
                                <span>控制台</span>
                            </button>
                            <button onclick="createBackup()" class="btn btn-outline flex flex-col items-center justify-center p-4">
                                <i class="fas fa-save text-xl mb-2"></i>
                                <span>创建备份</span>
                            </button>
                            <button onclick="loadPage('files')" class="btn btn-outline flex flex-col items-center justify-center p-4">
                                <i class="fas fa-folder text-xl mb-2"></i>
                                <span>文件管理</span>
                            </button>
                            <button onclick="loadPage('plugins')" class="btn btn-outline flex flex-col items-center justify-center p-4">
                                <i class="fas fa-puzzle-piece text-xl mb-2"></i>
                                <span>插件管理</span>
                            </button>
                            <button onclick="loadPage('mods')" class="btn btn-outline flex flex-col items-center justify-center p-4">
                                <i class="fas fa-cube text-xl mb-2"></i>
                                <span>模组管理</span>
                            </button>
                            <button onclick="restartServer()" class="btn btn-outline flex flex-col items-center justify-center p-4">
                                <i class="fas fa-redo text-xl mb-2"></i>
                                <span>重启服务器</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `}
    `;
}

// 控制台页面
async function loadConsolePage() {
    // 获取控制台历史
    let consoleHistory = [];
    if (currentServer) {
        try {
            const response = await fetch(`/api/server/console?limit=100`);
            const data = await response.json();
            if (data.success) {
                consoleHistory = data.console;
            }
        } catch (error) {
            console.error('获取控制台历史失败:', error);
        }
    }
    
    return `
        <div class="content-header">
            <h2 class="page-title"><i class="fas fa-terminal"></i> 服务器控制台</h2>
            <div class="content-actions">
                <button onclick="clearConsole()" class="btn btn-sm btn-outline">
                    <i class="fas fa-trash"></i> 清空
                </button>
                <button onclick="downloadConsoleLog()" class="btn btn-sm btn-outline">
                    <i class="fas fa-download"></i> 下载日志
                </button>
            </div>
        </div>
        
        ${!currentServer ? `
            <div class="card">
                <div class="card-body">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle empty-icon"></i>
                        <h3 class="empty-title">未选择服务器</h3>
                        <p class="empty-description">请从右上角选择器选择一个服务器。</p>
                    </div>
                </div>
            </div>
        ` : `
            <div class="console-container">
                <div class="console-toolbar">
                    <button onclick="startServer()" class="btn btn-success">
                        <i class="fas fa-play"></i> 启动
                    </button>
                    <button onclick="stopServer()" class="btn btn-danger">
                        <i class="fas fa-stop"></i> 停止
                    </button>
                    <button onclick="restartServer()" class="btn btn-warning">
                        <i class="fas fa-redo"></i> 重启
                    </button>
                    <div class="ml-auto flex items-center gap-2">
                        <div class="status-dot ${serverStatus?.running ? 'online' : 'offline'}"></div>
                        <span>${serverStatus?.running ? '运行中' : '已停止'}</span>
                    </div>
                </div>
                
                <div class="console-output" id="consoleOutput">
                    ${consoleHistory.length > 0 ? 
                        consoleHistory.map(line => `<div class="console-line">${line}</div>`).join('') :
                        '<div class="console-line text-gray-500">[系统] 控制台已就绪，等待输出...</div>'
                    }
                </div>
                
                <div class="console-input">
                    <input type="text" id="consoleInput" 
                           placeholder="输入Minecraft命令 (如: say hello)" 
                           onkeypress="if(event.key === 'Enter') sendConsoleCommand()">
                    <button onclick="sendConsoleCommand()" class="btn btn-primary">
                        <i class="fas fa-paper-plane"></i> 发送
                    </button>
                </div>
                
                <div class="mt-4">
                    <h4 class="mb-2">常用命令:</h4>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="sendCommand('list')" class="btn btn-sm btn-outline">list</button>
                        <button onclick="sendCommand('say Hello!')" class="btn btn-sm btn-outline">say</button>
                        <button onclick="sendCommand('time set day')" class="btn btn-sm btn-outline">白天</button>
                        <button onclick="sendCommand('time set night')" class="btn btn-sm btn-outline">夜晚</button>
                        <button onclick="sendCommand('weather clear')" class="btn btn-sm btn-outline">晴天</button>
                        <button onclick="sendCommand('weather rain')" class="btn btn-sm btn-outline">雨天</button>
                        <button onclick="sendCommand('gamemode survival')" class="btn btn-sm btn-outline">生存模式</button>
                        <button onclick="sendCommand('gamemode creative')" class="btn btn-sm btn-outline">创造模式</button>
                    </div>
                </div>
            </div>
        `}
    `;
}

// 玩家管理页面
async function loadPlayersPage() {
    let players = [];
    if (currentServer) {
        try {
            const response = await fetch('/api/server/players');
            const data = await response.json();
            if (data.success) {
                players = data.players;
            }
        } catch (error) {
            console.error('获取玩家列表失败:', error);
        }
    }
    
    return `
        <div class="content-header">
            <h2 class="page-title"><i class="fas fa-users"></i> 玩家管理</h2>
            <div class="content-actions">
                <button onclick="refreshPlayerList()" class="btn btn-sm btn-outline">
                    <i class="fas fa-redo"></i> 刷新列表
                </button>
            </div>
        </div>
        
        ${!currentServer ? `
            <div class="card">
                <div class="card-body">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle empty-icon"></i>
                        <h3 class="empty-title">未选择服务器</h3>
                        <p class="empty-description">请从右上角选择器选择一个服务器。</p>
                    </div>
                </div>
            </div>
        ` : `
            <div class="space-y-6">
                <div class="card">
                    <div class="card-header">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-user-friends"></i>
                            <span>在线玩家: <strong>${players.length}</strong></span>
                        </div>
                        <div>
                            <input type="text" id="playerSearch" placeholder="搜索玩家..." class="form-control">
                        </div>
                    </div>
                    <div class="card-body">
                        ${players.length > 0 ? `
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>玩家名</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody id="playersTableBody">
                                        ${players.map(player => `
                                            <tr>
                                                <td>
                                                    <div class="flex items-center gap-2">
                                                        <i class="fas fa-user"></i>
                                                        <span>${player}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div class="flex gap-2">
                                                        <button onclick="kickPlayer('${player}')" class="btn btn-sm btn-danger">
                                                            <i class="fas fa-user-slash"></i> 踢出
                                                        </button>
                                                        <button onclick="opPlayer('${player}')" class="btn btn-sm btn-success">
                                                            <i class="fas fa-crown"></i> 授予OP
                                                        </button>
                                                        <button onclick="sendCommand('tp ${player}')" class="btn btn-sm btn-primary">
                                                            <i class="fas fa-location-arrow"></i> 传送
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state py-8">
                                <i class="fas fa-user-slash empty-icon"></i>
                                <h3 class="empty-title">暂无在线玩家</h3>
                                <p class="empty-description">服务器当前没有在线玩家</p>
                            </div>
                        `}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-cog"></i> 玩家管理工具</h3>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <h4 class="mb-2">踢出玩家</h4>
                                <div class="space-y-2">
                                    <input type="text" id="kickPlayerName" placeholder="玩家名" class="form-control">
                                    <input type="text" id="kickReason" placeholder="原因 (可选)" class="form-control">
                                    <button onclick="kickPlayerByName()" class="btn btn-danger w-full">
                                        <i class="fas fa-user-slash"></i> 踢出
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h4 class="mb-2">授予OP权限</h4>
                                <div class="space-y-2">
                                    <input type="text" id="opPlayerName" placeholder="玩家名" class="form-control">
                                    <button onclick="opPlayerByName()" class="btn btn-success w-full">
                                        <i class="fas fa-crown"></i> 授予OP
                                    </button>
                                </div>
                            </div>
                            <div>
                                <h4 class="mb-2">发送消息</h4>
                                <div class="space-y-2">
                                    <input type="text" id="messagePlayer" placeholder="玩家名 (留空为全体)" class="form-control">
                                    <input type="text" id="messageContent" placeholder="消息内容" class="form-control">
                                    <button onclick="sendMessageToPlayer()" class="btn btn-primary w-full">
                                        <i class="fas fa-paper-plane"></i> 发送
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `}
    `;
}

// 插件管理页面
async function loadPluginsPage() {
    let plugins = [];
    if (currentServer) {
        try {
            const response = await fetch(`/api/plugins?serverPath=${encodeURIComponent(currentServer.path)}`);
            const data = await response.json();
            if (data.success) {
                plugins = data.plugins;
            }
        } catch (error) {
            console.error('获取插件列表失败:', error);
        }
    }
    
    return `
        <div class="content-header">
            <h2 class="page-title"><i class="fas fa-puzzle-piece"></i> 插件管理</h2>
            <div class="content-actions">
                <button onclick="refreshPluginList()" class="btn btn-sm btn-outline">
                    <i class="fas fa-redo"></i> 刷新列表
                </button>
                <button onclick="showUploadPluginModal()" class="btn btn-sm btn-primary">
                    <i class="fas fa-upload"></i> 上传插件
                </button>
            </div>
        </div>
        
        ${!currentServer ? `
            <div class="card">
                <div class="card-body">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle empty-icon"></i>
                        <h3 class="empty-title">未选择服务器</h3>
                        <p class="empty-description">请从右上角选择器选择一个服务器。</p>
                    </div>
                </div>
            </div>
        ` : `
            <div class="space-y-6">
                <div class="card">
                    <div class="card-header">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-plug"></i>
                            <span>插件数量: <strong>${plugins.length}</strong></span>
                        </div>
                        <div>
                            <input type="text" id="pluginSearch" placeholder="搜索插件..." class="form-control">
                        </div>
                    </div>
                    <div class="card-body">
                        ${plugins.length > 0 ? `
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th width="40"></th>
                                            <th>插件名称</th>
                                            <th>文件名</th>
                                            <th>大小</th>
                                            <th>修改时间</th>
                                            <th>状态</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody id="pluginsTableBody">
                                        ${plugins.map(plugin => `
                                            <tr>
                                                <td>
                                                    <div class="flex items-center justify-center">
                                                        <i class="fas fa-plug"></i>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div class="font-bold">${plugin.name}</div>
                                                </td>
                                                <td>
                                                    <code class="text-sm">${plugin.filename}</code>
                                                </td>
                                                <td>${plugin.size}</td>
                                                <td>${new Date(plugin.modified).toLocaleString()}</td>
                                                <td>
                                                    <span class="px-2 py-1 rounded text-xs ${plugin.enabled ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}">
                                                        ${plugin.enabled ? '已启用' : '已禁用'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div class="flex gap-2">
                                                        ${plugin.enabled ? `
                                                            <button onclick="disablePlugin('${plugin.filename}')" class="btn btn-sm btn-warning">
                                                                <i class="fas fa-ban"></i> 禁用
                                                            </button>
                                                        ` : `
                                                            <button onclick="enablePlugin('${plugin.filename}')" class="btn btn-sm btn-success">
                                                                <i class="fas fa-check"></i> 启用
                                                            </button>
                                                        `}
                                                        <button onclick="deletePlugin('${plugin.filename}')" class="btn btn-sm btn-danger">
                                                            <i class="fas fa-trash"></i> 删除
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state py-8">
                                <i class="fas fa-plug empty-icon"></i>
                                <h3 class="empty-title">暂无插件</h3>
                                <p class="empty-description">服务器 plugins 目录为空</p>
                                <button onclick="showUploadPluginModal()" class="btn btn-primary mt-4">
                                    <i class="fas fa-upload"></i> 上传插件
                                </button>
                            </div>
                        `}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-bolt"></i> 批量操作</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex gap-2">
                            <button onclick="enableAllPlugins()" class="btn btn-success">
                                <i class="fas fa-check-double"></i> 启用所有
                            </button>
                            <button onclick="disableAllPlugins()" class="btn btn-warning">
                                <i class="fas fa-ban"></i> 禁用所有
                            </button>
                            <button onclick="reloadAllPlugins()" class="btn btn-primary">
                                <i class="fas fa-sync"></i> 重载所有
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `}
        
        <!-- 上传插件模态框 -->
        <div class="modal" id="uploadPluginModal" style="display: none;">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="fas fa-upload"></i> 上传插件</h3>
                    <button class="modal-close" onclick="closePluginModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="space-y-4">
                        <div class="form-group">
                            <label class="form-label">选择插件文件 (.jar)</label>
                            <div class="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                                 onclick="openPluginFileDialog()"
                                 id="pluginUploadArea">
                                <i class="fas fa-file-archive text-3xl text-gray-500 mb-3"></i>
                                <p class="text-gray-400 mb-2">点击选择插件文件</p>
                                <p class="text-sm text-gray-500">支持 .jar 格式，最大 1GB</p>
                            </div>
                            <input type="file" id="pluginFileInput" accept=".jar" multiple style="display: none;">
                        </div>
                        
                        <div id="selectedPluginFiles" style="display: none;">
                            <h4 class="mb-2 font-medium">已选择文件:</h4>
                            <div class="max-h-60 overflow-y-auto space-y-2" id="pluginFileList"></div>
                        </div>
                        
                        <div id="pluginUploadProgress" style="display: none;">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-sm">上传进度</span>
                                <span class="text-sm" id="pluginProgressText">0%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" id="pluginProgressFill" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closePluginModal()">取消</button>
                    <button class="btn btn-primary" onclick="uploadPluginFiles()" id="uploadPluginBtn" disabled>
                        <i class="fas fa-upload"></i> 上传
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 文件管理页面
async function loadFilesPage() {
    let files = [];
    let currentPath = window.currentFilePath || '/';
    
    if (currentServer) {
        try {
            const response = await fetch(`/api/files?serverPath=${encodeURIComponent(currentServer.path)}&path=${encodeURIComponent(currentPath)}`);
            const data = await response.json();
            if (data.success) {
                files = data.files;
                currentPath = data.currentPath;
            }
        } catch (error) {
            console.error('获取文件列表失败:', error);
        }
    }
    
    return `
        <div class="content-header">
            <h2 class="page-title"><i class="fas fa-folder"></i> 文件管理</h2>
            <div class="content-actions">
                <button onclick="refreshFileList()" class="btn btn-sm btn-outline">
                    <i class="fas fa-redo"></i> 刷新
                </button>
                <button onclick="showCreateFolderModal()" class="btn btn-sm btn-primary">
                    <i class="fas fa-folder-plus"></i> 新建文件夹
                </button>
                <button onclick="showFileUploadModal()" class="btn btn-sm btn-success">
                    <i class="fas fa-upload"></i> 上传文件
                </button>
            </div>
        </div>
        
        ${!currentServer ? `
            <div class="card">
                <div class="card-body">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle empty-icon"></i>
                        <h3 class="empty-title">未选择服务器</h3>
                        <p class="empty-description">请从右上角选择器选择一个服务器。</p>
                    </div>
                </div>
            </div>
        ` : `
            <div class="space-y-4">
                <div class="card">
                    <div class="card-body">
                        <div class="flex items-center gap-2 text-sm">
                            <button onclick="navigateToPath('/')" class="btn btn-link">
                                <i class="fas fa-home"></i> 根目录
                            </button>
                            ${currentPath.split('/').filter(p => p).map((part, index, arr) => {
                                const path = '/' + arr.slice(0, index + 1).join('/');
                                return `
                                    <span class="text-gray-500">/</span>
                                    <button onclick="navigateToPath('${path}')" class="btn btn-link">
                                        ${part}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <div class="flex gap-2">
                            <button onclick="selectAllFiles()" class="btn btn-sm btn-outline">
                                <i class="fas fa-check-square"></i> 全选
                            </button>
                            <button onclick="deselectAllFiles()" class="btn btn-sm btn-outline">
                                <i class="fas fa-square"></i> 取消全选
                            </button>
                            <button onclick="deleteSelectedFiles()" class="btn btn-sm btn-danger">
                                <i class="fas fa-trash"></i> 删除选中
                            </button>
                            <button onclick="downloadSelectedFiles()" class="btn btn-sm btn-primary">
                                <i class="fas fa-download"></i> 下载选中
                            </button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${files.length > 0 ? `
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th width="40">
                                                <input type="checkbox" id="selectAllCheckbox" onchange="toggleSelectAll()">
                                            </th>
                                            <th>名称</th>
                                            <th>类型</th>
                                            <th>大小</th>
                                            <th>修改时间</th>
                                            <th>权限</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody id="filesTableBody">
                                        ${files.map(file => {
                                            // 检查文件扩展名，判断是否为文本文件
                                            const textExtensions = ['.txt', '.json', '.yml', '.yaml', '.properties', '.ini', '.cfg', '.conf', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.md', '.log'];
                                            const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                                            const isTextFile = textExtensions.includes(ext);
                                            
                                            return `
                                            <tr>
                                                <td>
                                                    <input type="checkbox" class="file-checkbox" data-path="${file.name}">
                                                </td>
                                                <td>
                                                    <div class="flex items-center gap-2 cursor-pointer" onclick="${file.type === 'directory' ? `navigateToPath('${currentPath}/${file.name}')` : `viewFile('${file.name}')`}">
                                                        ${file.type === 'directory' ? 
                                                            `<i class="fas fa-folder text-yellow-500"></i>` : 
                                                            `<i class="${getFileIcon(file.name)}"></i>`}
                                                        <span>${file.name}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span class="text-sm">${file.type === 'directory' ? '文件夹' : '文件'}</span>
                                                </td>
                                                <td>${file.size}</td>
                                                <td>${new Date(file.modified).toLocaleString()}</td>
                                                <td>
                                                    <code class="text-xs">${file.permissions}</code>
                                                </td>
                                                <td>
                                                    <div class="flex gap-2">
                                                        ${file.type === 'directory' ? `
                                                            <button onclick="navigateToPath('${currentPath}/${file.name}')" class="btn btn-sm btn-outline">
                                                                <i class="fas fa-folder-open"></i> 打开
                                                            </button>
                                                        ` : `
                                                            ${isTextFile ? `
                                                                <button onclick="openTextEditor('${file.name}')" class="btn btn-sm btn-primary">
                                                                    <i class="fas fa-edit"></i> 编辑
                                                                </button>
                                                            ` : `
                                                                <button onclick="viewBinaryFile('${file.name}')" class="btn btn-sm btn-outline">
                                                                    <i class="fas fa-eye"></i> 查看
                                                                </button>
                                                            `}
                                                            <button onclick="downloadFile('${file.name}')" class="btn btn-sm btn-outline">
                                                                <i class="fas fa-download"></i> 下载
                                                            </button>
                                                        `}
                                                        <button onclick="renameFile('${file.name}')" class="btn btn-sm btn-warning">
                                                            <i class="fas fa-edit"></i> 重命名
                                                        </button>
                                                        <button onclick="deleteFile('${file.name}')" class="btn btn-sm btn-danger">
                                                            <i class="fas fa-trash"></i> 删除
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `}).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state py-8">
                                <i class="fas fa-folder-open empty-icon"></i>
                                <h3 class="empty-title">目录为空</h3>
                                <p class="empty-description">当前目录没有文件或文件夹</p>
                                <button onclick="showFileUploadModal()" class="btn btn-primary mt-4">
                                    <i class="fas fa-upload"></i> 上传文件
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `}
    `;
}

// 备份管理页面
async function loadBackupsPage() {
    let backups = [];
    
    try {
        const response = await fetch('/api/backups');
        const data = await response.json();
        if (data.success) {
            backups = data.backups;
        }
    } catch (error) {
        console.error('获取备份列表失败:', error);
    }
    
    return `
        <div class="content-header">
            <h2 class="page-title"><i class="fas fa-save"></i> 备份管理</h2>
            <div class="content-actions">
                <button onclick="refreshBackupList()" class="btn btn-sm btn-outline">
                    <i class="fas fa-redo"></i> 刷新列表
                </button>
                <button onclick="createBackup()" class="btn btn-sm btn-success">
                    <i class="fas fa-plus"></i> 创建备份
                </button>
            </div>
        </div>
        
        ${!currentServer ? `
            <div class="card">
                <div class="card-body">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle empty-icon"></i>
                        <h3 class="empty-title">未选择服务器</h3>
                        <p class="empty-description">请从右上角选择器选择一个服务器。</p>
                    </div>
                </div>
            </div>
        ` : `
            <div class="space-y-6">
                <div class="card">
                    <div class="card-header">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-archive"></i>
                            <span>备份数量: <strong>${backups.length}</strong></span>
                        </div>
                        <div>
                            <span>总大小: <strong>${calculateTotalBackupSize(backups)}</strong></span>
                        </div>
                    </div>
                    <div class="card-body">
                        ${backups.length > 0 ? `
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>备份名称</th>
                                            <th>大小</th>
                                            <th>创建时间</th>
                                            <th>修改时间</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody id="backupsTableBody">
                                        ${backups.map(backup => `
                                            <tr>
                                                <td>
                                                    <div class="flex items-center gap-2">
                                                        <i class="fas fa-archive"></i>
                                                        <span>${backup.name}</span>
                                                    </div>
                                                </td>
                                                <td>${backup.size}</td>
                                                <td>${new Date(backup.created).toLocaleString()}</td>
                                                <td>${new Date(backup.modified).toLocaleString()}</td>
                                                <td>
                                                    <div class="flex gap-2">
                                                        <button onclick="downloadBackup('${backup.name}')" class="btn btn-sm btn-outline">
                                                            <i class="fas fa-download"></i> 下载
                                                        </button>
                                                        <button onclick="restoreBackup('${backup.name}')" class="btn btn-sm btn-warning">
                                                            <i class="fas fa-history"></i> 恢复
                                                        </button>
                                                        <button onclick="deleteBackup('${backup.name}')" class="btn btn-sm btn-danger">
                                                            <i class="fas fa-trash"></i> 删除
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="empty-state py-8">
                                <i class="fas fa-archive empty-icon"></i>
                                <h3 class="empty-title">暂无备份</h3>
                                <p class="empty-description">还没有创建任何备份</p>
                                <button onclick="createBackup()" class="btn btn-primary mt-4">
                                    <i class="fas fa-plus"></i> 创建第一个备份
                                </button>
                            </div>
                        `}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-cog"></i> 备份设置</h3>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label class="block mb-2">自动备份间隔</label>
                                <select id="autoBackupInterval" class="form-control">
                                    <option value="0">不自动备份</option>
                                    <option value="1">每小时</option>
                                    <option value="6">每6小时</option>
                                    <option value="12">每12小时</option>
                                    <option value="24" selected>每天</option>
                                    <option value="168">每周</option>
                                </select>
                            </div>
                            <div>
                                <label class="block mb-2">最大备份数量</label>
                                <select id="maxBackups" class="form-control">
                                    <option value="5">5个</option>
                                    <option value="10">10个</option>
                                    <option value="20" selected>20个</option>
                                    <option value="50">50个</option>
                                    <option value="100">100个</option>
                                </select>
                            </div>
                            <div>
                                <label class="block mb-2">备份保留时间</label>
                                <select id="backupRetention" class="form-control">
                                    <option value="7">7天</option>
                                    <option value="30" selected>30天</option>
                                    <option value="90">90天</option>
                                    <option value="180">180天</option>
                                    <option value="365">365天</option>
                                </select>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="saveBackupSettings()" class="btn btn-primary">
                                <i class="fas fa-save"></i> 保存设置
                            </button>
                            <button onclick="cleanupOldBackups()" class="btn btn-warning">
                                <i class="fas fa-broom"></i> 清理旧备份
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `}
    `;
}

// 服务器管理页面
async function loadServersPage() {
    return `
        <div class="content-header">
            <h2 class="page-title"><i class="fas fa-server"></i> 服务器管理</h2>
            <div class="content-actions">
                <button onclick="refreshServerList()" class="btn btn-sm btn-outline">
                    <i class="fas fa-redo"></i> 刷新列表
                </button>
                <button onclick="showAddServerModal()" class="btn btn-sm btn-primary">
                    <i class="fas fa-plus"></i> 添加服务器
                </button>
            </div>
        </div>
        
        <div class="card">
            <div class="card-body">
                <div class="loading" id="serversGrid">
                    <div class="spinner"></div>
                    <div class="loading-text">加载服务器列表...</div>
                </div>
            </div>
        </div>
    `;
}

// 模组管理页面
async function loadModsPage() {
    let mods = [];
    let errorMessage = null;
    
    if (currentServer) {
        try {
            const response = await fetch(`/api/mods?serverPath=${encodeURIComponent(currentServer.path)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                mods = data.mods || [];
                console.log('加载模组列表成功:', mods.length, '个模组');
            } else {
                errorMessage = data.message || '获取模组列表失败';
                console.error('服务器返回错误:', data.message);
            }
        } catch (error) {
            console.error('获取模组列表失败:', error);
            errorMessage = `网络请求失败: ${error.message}`;
        }
    }
    
    return `
        <div class="content-header">
            <h2 class="page-title"><i class="fas fa-cube"></i> 模组管理</h2>
            <div class="content-actions">
                <button onclick="refreshModList()" class="btn btn-sm btn-outline">
                    <i class="fas fa-redo"></i> 刷新列表
                </button>
                <button onclick="showUploadModModal()" class="btn btn-sm btn-primary">
                    <i class="fas fa-upload"></i> 上传模组
                </button>
            </div>
        </div>
        
        ${!currentServer ? `
            <div class="card">
                <div class="card-body">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle empty-icon"></i>
                        <h3 class="empty-title">未选择服务器</h3>
                        <p class="empty-description">请从右上角选择器选择一个服务器。</p>
                    </div>
                </div>
            </div>
        ` : `
            <div class="space-y-4">
                ${errorMessage ? `
                    <div class="alert alert-error">
                        <div class="alert-content">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div>
                                <strong>加载失败</strong>
                                <p>${errorMessage}</p>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline" onclick="refreshModList()">
                            <i class="fas fa-redo"></i> 重试
                        </button>
                    </div>
                ` : ''}
                
                <div class="card">
                    <div class="card-header">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-cube"></i>
                            <span>模组数量: <strong>${mods.length}</strong></span>
                        </div>
                        <div>
                            <input type="text" id="modSearch" placeholder="搜索模组..." class="form-control w-64">
                        </div>
                    </div>
                    <div class="card-body">
                        ${mods.length > 0 ? `
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th width="40"></th>
                                            <th>模组名称</th>
                                            <th>文件名</th>
                                            <th>大小</th>
                                            <th>修改时间</th>
                                            <th>状态</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody id="modsTableBody">
                                        ${mods.map(mod => {
                                            const isEnabled = mod.enabled !== false;
                                            const statusClass = isEnabled ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300';
                                            const statusText = isEnabled ? '已启用' : '已禁用';
                                            
                                            return `
                                                <tr>
                                                    <td>
                                                        <div class="flex items-center justify-center">
                                                            <i class="fas fa-cube"></i>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div class="font-bold">${mod.name || mod.filename.replace('.jar', '')}</div>
                                                    </td>
                                                    <td>
                                                        <code class="text-sm bg-gray-800 px-2 py-1 rounded">${mod.filename}</code>
                                                    </td>
                                                    <td>${mod.size || 'N/A'}</td>
                                                    <td>${mod.modified ? new Date(mod.modified).toLocaleString() : 'N/A'}</td>
                                                    <td>
                                                        <span class="px-2 py-1 rounded text-xs ${statusClass}">
                                                            ${statusText}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div class="flex gap-2">
                                                            ${isEnabled ? `
                                                                <button onclick="disableMod('${mod.filename}')" class="btn btn-sm btn-warning">
                                                                    <i class="fas fa-ban"></i> 禁用
                                                                </button>
                                                            ` : `
                                                                <button onclick="enableMod('${mod.filename}')" class="btn btn-sm btn-success">
                                                                    <i class="fas fa-check"></i> 启用
                                                                </button>
                                                            `}
                                                            <button onclick="deleteMod('${mod.filename}')" class="btn btn-sm btn-danger">
                                                                <i class="fas fa-trash"></i> 删除
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : errorMessage ? '' : `
                            <div class="empty-state py-8">
                                <i class="fas fa-cube empty-icon"></i>
                                <h3 class="empty-title">暂无模组</h3>
                                <p class="empty-description">服务器 mods 目录为空，或者未找到 .jar 文件</p>
                                <button onclick="showUploadModModal()" class="btn btn-primary mt-4">
                                    <i class="fas fa-upload"></i> 上传模组
                                </button>
                            </div>
                        `}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-info-circle"></i> 模组管理说明</h3>
                    </div>
                    <div class="card-body">
                        <div class="space-y-2">
                            <p class="text-sm text-gray-400">
                                <i class="fas fa-info-circle text-blue-400 mr-2"></i>
                                模组文件应放置在服务器的 <code class="bg-gray-800 px-2 py-1 rounded">mods</code> 目录中
                            </p>
                            <p class="text-sm text-gray-400">
                                <i class="fas fa-file-archive text-yellow-400 mr-2"></i>
                                模组文件必须是 .jar 格式，文件名不限（如：jei_1.19.2.jar, journeymap-1.19-5.9.0.jar）
                            </p>
                            <p class="text-sm text-gray-400">
                                <i class="fas fa-exclamation-triangle text-yellow-400 mr-2"></i>
                                禁用模组可以通过重命名文件为 <code class="bg-gray-800 px-2 py-1 rounded">文件名.disabled</code>
                            </p>
                            <p class="text-sm text-gray-400">
                                <i class="fas fa-sync-alt text-green-400 mr-2"></i>
                                启用/禁用模组后需要重启服务器才能生效
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 上传模组模态框 -->
            <div class="modal" id="uploadModModal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-upload"></i> 上传模组</h3>
                        <button class="modal-close" onclick="closeModal('uploadModModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">选择模组文件 (.jar)</label>
                            <div class="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center" 
                                 id="modUploadArea"
                                 ondrop="handleModDrop(event)"
                                 ondragover="handleDragOver(event)"
                                 ondragleave="handleDragLeave(event)">
                                <i class="fas fa-file-archive text-4xl text-gray-500 mb-4"></i>
                                <p class="text-gray-400 mb-2">拖拽模组文件到这里，或点击选择文件</p>
                                <p class="text-sm text-gray-500 mb-4">支持 .jar 格式，文件名不限，最大 1GB</p>
                                <input type="file" id="modFileInput" accept=".jar" multiple style="display: none;">
                                <button onclick="document.getElementById('modFileInput').click()" class="btn btn-outline">
                                    <i class="fas fa-folder-open mr-2"></i> 选择文件
                                </button>
                            </div>
                        </div>
                        
                        <div id="modUploadProgress" style="display: none;">
                            <div class="progress-bar mt-4">
                                <div class="progress-fill" id="modProgressFill" style="width: 0%"></div>
                            </div>
                            <div class="flex justify-between mt-2">
                                <span class="text-sm" id="modProgressText">0%</span>
                                <span class="text-sm text-gray-500" id="modUploadStatus">准备上传...</span>
                            </div>
                        </div>
                        
                        <div id="modSelectedFiles" class="mt-4" style="display: none;">
                            <h4 class="mb-2">已选择文件:</h4>
                            <ul id="modFileList" class="space-y-2 max-h-40 overflow-y-auto"></ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeModal('uploadModModal')">取消</button>
                        <button class="btn btn-primary" onclick="uploadMods()" id="modUploadBtn">
                            <i class="fas fa-upload mr-2"></i> 上传
                        </button>
                    </div>
                </div>
            </div>
        `}
    `;
}

// 系统设置页面
async function loadSettingsPage() {
    return `
        <div class="content-header">
            <h2 class="page-title"><i class="fas fa-cog"></i> 系统设置</h2>
        </div>
        
        <div class="card">
            <div class="card-body">
                <div class="space-y-6">
                    <div>
                        <h3 class="text-lg font-bold mb-4"><i class="fas fa-globe"></i> 面板设置</h3>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block mb-2">面板语言</label>
                                <select class="form-control">
                                    <option value="zh-CN" selected>简体中文</option>
                                    <option value="en-US">English</option>
                                </select>
                            </div>
                            <div>
                                <label class="block mb-2">主题</label>
                                <select class="form-control">
                                    <option value="dark" selected>暗色主题</option>
                                    <option value="light">亮色主题</option>
                                    <option value="auto">跟随系统</option>
                                </select>
                            </div>
                            <div>
                                <label class="block mb-2">自动刷新间隔</label>
                                <select class="form-control">
                                    <option value="0">不自动刷新</option>
                                    <option value="5">5秒</option>
                                    <option value="10">10秒</option>
                                    <option value="30" selected>30秒</option>
                                    <option value="60">1分钟</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-bold mb-4"><i class="fas fa-server"></i> 服务器设置</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="md:col-span-2">
                                <label class="block mb-2">默认Java参数</label>
                                <textarea class="form-control" rows="3">-Xmx4G -Xms2G -jar server.jar nogui</textarea>
                            </div>
                            <div>
                                <label class="block mb-2">服务器启动超时</label>
                                <input type="number" class="form-control" value="60" min="10" max="300">
                                <small class="text-gray-500">服务器启动的最大等待时间（秒）</small>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 class="text-lg font-bold mb-4"><i class="fas fa-user-shield"></i> 安全设置</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block mb-2">会话超时时间</label>
                                <select class="form-control">
                                    <option value="15">15分钟</option>
                                    <option value="30">30分钟</option>
                                    <option value="60" selected>1小时</option>
                                    <option value="1440">24小时</option>
                                </select>
                            </div>
                            <div>
                                <label class="block mb-2">最大登录尝试次数</label>
                                <input type="number" class="form-control" value="5" min="1" max="10">
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-2">
                        <button onclick="saveAllSettings()" class="btn btn-primary">
                            <i class="fas fa-save"></i> 保存所有设置
                        </button>
                        <button onclick="loadDefaultSettings()" class="btn btn-secondary">
                            <i class="fas fa-undo"></i> 恢复默认设置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==================== 页面功能初始化 ====================
function initializePageFunctions(pageName) {
    console.log(`初始化页面功能: ${pageName}`);
    
    switch(pageName) {
        case 'dashboard':
            initDashboard();
            break;
        case 'console':
            initConsole();
            break;
        case 'players':
            initPlayers();
            break;
        case 'plugins':
            initPlugins();
            break;
        case 'mods':
            initMods();
            break;
        case 'files':
            initFiles();
            break;
        case 'backups':
            initBackups();
            break;
        case 'servers':
            initServers();
            break;
        case 'settings':
            initSettings();
            break;
    }
    
    // 滚动到顶部
    const contentArea = document.getElementById('main-content');
    if (contentArea) {
        contentArea.scrollTop = 0;
    }
}

function initDashboard() {
    // 启动状态更新
    updateDashboardStats();
    
    // 为玩家操作按钮添加事件
    document.querySelectorAll('.players-list button').forEach(button => {
        // 事件已经在HTML中绑定
    });
}

function initConsole() {
    // 聚焦到输入框
    const consoleInput = document.getElementById('consoleInput');
    if (consoleInput) {
        consoleInput.focus();
        
        // 添加键盘快捷键
        consoleInput.addEventListener('keydown', function(event) {
            // Ctrl + L 清空控制台
            if (event.ctrlKey && event.key === 'l') {
                event.preventDefault();
                clearConsole();
            }
            // 上箭头历史记录
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                // TODO: 实现命令历史
            }
        });
    }
    
    // 为快捷命令按钮添加事件
    document.querySelectorAll('.shortcut-buttons button').forEach(button => {
        button.addEventListener('click', function() {
            const command = this.textContent;
            sendCommand(command);
        });
    });
}

function initPlayers() {
    // 搜索功能
    const searchInput = document.getElementById('playerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#playersTableBody tr');
            
            rows.forEach(row => {
                const playerName = row.querySelector('.player-info span')?.textContent?.toLowerCase() || '';
                row.style.display = playerName.includes(searchTerm) ? '' : 'none';
            });
        });
    }
    
    // 工具输入框回车键支持
    document.getElementById('kickPlayerName')?.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') kickPlayerByName();
    });
    
    document.getElementById('opPlayerName')?.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') opPlayerByName();
    });
    
    document.getElementById('messageContent')?.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') sendMessageToPlayer();
    });
}

function initPlugins() {
    // 搜索功能
    const searchInput = document.getElementById('pluginSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#pluginsTableBody tr');
            
            rows.forEach(row => {
                const pluginName = row.querySelector('.plugin-name')?.textContent?.toLowerCase() || '';
                row.style.display = pluginName.includes(searchTerm) ? '' : 'none';
            });
        });
    }
}

function initMods() {
    // 搜索功能
    const searchInput = document.getElementById('modSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#modsTableBody tr');
            
            rows.forEach(row => {
                const modName = row.querySelector('td:nth-child(2) .font-bold')?.textContent?.toLowerCase() || '';
                const fileName = row.querySelector('td:nth-child(3) code')?.textContent?.toLowerCase() || '';
                
                if (modName.includes(searchTerm) || fileName.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
    
    // 文件选择事件
    const fileInput = document.getElementById('modFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleModFileSelect);
    }
}

function initFiles() {
    // 搜索功能（如果需要）
    // 上传区域拖拽
    // 文件选择事件
    // 等等...
}

function initBackups() {
    // 备份设置表单事件
    // 等等...
}

function initServers() {
    // 加载服务器列表
    loadServersGrid();
}

function initSettings() {
    // 设置表单事件
    document.querySelectorAll('#settingsForm input, #settingsForm select, #settingsForm textarea').forEach(input => {
        input.addEventListener('change', function() {
            // 标记设置已更改
            document.querySelector('#saveSettingsBtn').disabled = false;
        });
    });
}

// ==================== 服务器操作函数 ====================
async function startServer() {
    if (!currentServer) {
        showNotification('请先选择一个服务器', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/server/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverPath: currentServer.path })
        });
        
        const data = await response.json();
        showNotification(data.message, data.success ? 'success' : 'error');
        
        if (data.success) {
            // 等待一段时间后刷新状态
            setTimeout(() => {
                refreshServerStatus();
            }, 2000);
        }
    } catch (error) {
        console.error('启动服务器失败:', error);
        showNotification('启动服务器失败: ' + error.message, 'error');
    }
}

async function stopServer() {
    if (!currentServer) {
        showNotification('请先选择一个服务器', 'error');
        return;
    }
    
    if (!confirm('确定要停止服务器吗？')) {
        return;
    }
    
    try {
        const response = await fetch('/api/server/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        showNotification(data.message, data.success ? 'success' : 'error');
        
        if (data.success) {
            setTimeout(() => {
                refreshServerStatus();
            }, 2000);
        }
    } catch (error) {
        console.error('停止服务器失败:', error);
        showNotification('停止服务器失败: ' + error.message, 'error');
    }
}

async function restartServer() {
    if (!currentServer) {
        showNotification('请先选择一个服务器', 'error');
        return;
    }
    
    if (!confirm('确定要重启服务器吗？服务器将短暂离线。')) {
        return;
    }
    
    try {
        const response = await fetch('/api/server/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        showNotification(data.message, data.success ? 'success' : 'error');
        
        if (data.success) {
            showNotification('服务器正在重启...', 'warning');
            setTimeout(() => {
                refreshServerStatus();
            }, 5000);
        }
    } catch (error) {
        console.error('重启服务器失败:', error);
        showNotification('重启服务器失败: ' + error.message, 'error');
    }
}

// ==================== 控制台函数 ====================
function appendConsoleOutput(text) {
    const consoleOutput = document.getElementById('consoleOutput');
    if (!consoleOutput) return;
    
    // 移除欢迎信息（如果存在）
    const welcome = consoleOutput.querySelector('.console-welcome');
    if (welcome) welcome.remove();
    
    // 确保文本是UTF-8编码
    let decodedText = text;
    
    // 如果文本包含乱码字符，尝试修复
    if (text.includes(' ') || text.includes('ï') || text.includes('¿') || text.includes('½')) {
        // 常见乱码模式修复
        decodedText = text
            .replace(/ã€‚/g, '，')
            .replace(/ã€/g, '、')
            .replace(/ã€Š/g, '《')
            .replace(/ã€‹/g, '》')
            .replace(/ã€/g, '」')
            .replace(/ã€Œ/g, '「')
            .replace(/ã€/g, '')  // 移除其他乱码
            .replace(/Â/g, '')   // 移除Â字符
            .replace(/Ã/g, '')   // 移除Ã字符
            .replace(/â€“/g, '–')
            .replace(/â€”/g, '—')
            .replace(/â€œ/g, '“')
            .replace(/â€/g, '”')
            .replace(/â€™/g, '’')
            .replace(/â€¦/g, '…');
    }
    
    const line = document.createElement('div');
    line.className = 'console-line';
    
    // 添加适当的HTML实体编码
    line.innerHTML = decodedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    consoleOutput.appendChild(line);
    
    // 自动滚动到底部
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function refreshConsoleOutput() {
    const consoleOutput = document.getElementById('consoleOutput');
    if (!consoleOutput) return;
    
    // 重新渲染所有控制台输出
    consoleOutput.innerHTML = consoleOutput.map(line => {
        let decodedLine = line;
        // 应用相同的解码规则
        if (line.includes(' ') || line.includes('ï') || line.includes('¿') || line.includes('½')) {
            decodedLine = line
                .replace(/ã€‚/g, '，')
                .replace(/ã€/g, '、')
                .replace(/ã€Š/g, '《')
                .replace(/ã€‹/g, '》')
                .replace(/ã€/g, '」')
                .replace(/ã€Œ/g, '「')
                .replace(/ã€/g, '')
                .replace(/Â/g, '')
                .replace(/Ã/g, '');
        }
        
        return `<div class="console-line">${decodedLine}</div>`;
    }).join('');
    
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
    const consoleOutput = document.getElementById('consoleOutput');
    if (consoleOutput) {
        consoleOutput.innerHTML = '<div class="console-line text-gray-500">[系统] 控制台已清空</div>';
    }
}

function sendConsoleCommand() {
    const input = document.getElementById('consoleInput');
    if (!input || !input.value.trim()) return;
    
    const command = input.value.trim();
    
    // 通过WebSocket发送
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'command',
            command: command
        }));
    } else {
        // 通过HTTP API发送
        fetch('/api/server/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        }).catch(error => {
            console.error('发送命令失败:', error);
            showNotification('发送命令失败', 'error');
        });
    }
    
    // 清空输入框
    input.value = '';
    input.focus();
}

function sendCommand(command) {
    const input = document.getElementById('consoleInput');
    if (input) {
        input.value = command;
        sendConsoleCommand();
    }
}

// ==================== 玩家管理函数 ====================
async function kickPlayer(player) {
    if (!currentServer) {
        showNotification('请先选择一个服务器', 'error');
        return;
    }
    
    const reason = prompt(`踢出玩家 ${player} 的原因（可选）:`, '由管理员踢出');
    
    try {
        const response = await fetch('/api/server/kick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player, reason })
        });
        
        const data = await response.json();
        showNotification(data.message, data.success ? 'success' : 'error');
    } catch (error) {
        console.error('踢出玩家失败:', error);
        showNotification('踢出玩家失败: ' + error.message, 'error');
    }
}

async function opPlayer(player) {
    if (!currentServer) {
        showNotification('请先选择一个服务器', 'error');
        return;
    }
    
    if (!confirm(`确定要授予玩家 ${player} OP权限吗？`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/server/op', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player })
        });
        
        const data = await response.json();
        showNotification(data.message, data.success ? 'success' : 'error');
    } catch (error) {
        console.error('授予OP权限失败:', error);
        showNotification('授予OP权限失败: ' + error.message, 'error');
    }
}

function kickPlayerByName() {
    const playerName = document.getElementById('kickPlayerName')?.value;
    const reason = document.getElementById('kickReason')?.value;
    
    if (!playerName) {
        showNotification('请输入玩家名', 'error');
        return;
    }
    
    kickPlayer(playerName, reason);
}

function opPlayerByName() {
    const playerName = document.getElementById('opPlayerName')?.value;
    
    if (!playerName) {
        showNotification('请输入玩家名', 'error');
        return;
    }
    
    opPlayer(playerName);
}

function sendMessageToPlayer() {
    const player = document.getElementById('messagePlayer')?.value;
    const content = document.getElementById('messageContent')?.value;
    
    if (!content) {
        showNotification('请输入消息内容', 'error');
        return;
    }
    
    const command = player ? `tell ${player} ${content}` : `say ${content}`;
    sendCommand(command);
    
    // 清空输入框
    if (document.getElementById('messageContent')) {
        document.getElementById('messageContent').value = '';
    }
}

async function refreshPlayerList() {
    if (!currentServer) return;
    
    try {
        const response = await fetch('/api/server/players');
        const data = await response.json();
        
        if (data.success) {
            // 更新页面中的玩家列表
            if (currentPage === 'players') {
                loadPage('players');
            }
        }
    } catch (error) {
        console.error('刷新玩家列表失败:', error);
    }
}

// ==================== 备份管理函数 ====================
async function createBackup() {
    if (!currentServer) {
        showNotification('请先选择一个服务器', 'error');
        return;
    }
    
    if (!confirm('确定要创建服务器备份吗？')) {
        return;
    }
    
    try {
        const response = await fetch('/api/backup/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverPath: currentServer.path })
        });
        
        const data = await response.json();
        showNotification(data.message, data.success ? 'success' : 'error');
        
        if (data.success) {
            setTimeout(() => {
                loadPage('backups');
            }, 2000);
        }
    } catch (error) {
        console.error('创建备份失败:', error);
        showNotification('创建备份失败: ' + error.message, 'error');
    }
}

function calculateTotalBackupSize(backups) {
    let totalBytes = 0;
    backups.forEach(backup => {
        // 解析大小字符串如 "1.23 MB"
        const match = backup.size.match(/([\d.]+)\s*(\w+)/);
        if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            
            const multipliers = {
                'B': 1,
                'KB': 1024,
                'MB': 1024 * 1024,
                'GB': 1024 * 1024 * 1024,
                'TB': 1024 * 1024 * 1024 * 1024
            };
            
            totalBytes += value * (multipliers[unit] || 1);
        }
    });
    
    return formatFileSize(totalBytes);
}

// ==================== 服务器管理函数 ====================
async function loadServersGrid() {
    console.log('正在加载服务器网格...');
    const serversGrid = document.getElementById('serversGrid');
    if (!serversGrid) {
        console.error('找不到 serversGrid 元素');
        return;
    }
    
    try {
        const response = await fetch('/api/servers');
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            serversGrid.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${data.servers && data.servers.length > 0 ? data.servers.map(server => `
                        <div class="card">
                            <div class="card-header">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 ${server.hasServerJar ? 'bg-blue-900' : 'bg-red-900'} rounded-lg flex items-center justify-center">
                                        <i class="fas fa-server ${server.hasServerJar ? 'text-blue-400' : 'text-red-400'}"></i>
                                    </div>
                                    <div>
                                        <h3 class="font-bold">${server.name}</h3>
                                        <p class="text-sm text-gray-500">ID: ${server.id}</p>
                                    </div>
                                </div>
                                <div class="flex flex-col items-end gap-1">
                                    <span class="px-2 py-1 rounded text-xs ${server.hasServerJar ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}">
                                        ${server.hasServerJar ? '就绪' : '缺少JAR'}
                                    </span>
                                    ${server.version ? `<span class="text-xs text-gray-400">${server.version}</span>` : ''}
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="space-y-2">
                                    <p class="text-sm flex items-center gap-2">
                                        <i class="fas fa-folder text-gray-500"></i>
                                        <span class="truncate" title="${server.path}">${server.path}</span>
                                    </p>
                                    <p class="text-sm flex items-center gap-2">
                                        <i class="fas fa-users text-gray-500"></i>
                                        <span>最大玩家: ${server.maxPlayers}</span>
                                    </p>
                                    <p class="text-sm flex items-center gap-2">
                                        <i class="fas fa-plug text-gray-500"></i>
                                        <span>端口: ${server.port}</span>
                                    </p>
                                </div>
                            </div>
                            <div class="card-footer">
                                <div class="flex flex-wrap gap-2">
                                    <button onclick="selectServer('${server.id}')" class="btn btn-sm btn-primary flex-1">
                                        <i class="fas fa-check"></i> 选择
                                    </button>
                                    ${!server.hasServerJar ? `
                                        <button onclick="uploadServerJar('${server.id}')" class="btn btn-sm btn-success flex-1">
                                            <i class="fas fa-upload"></i> 上传JAR
                                        </button>
                                    ` : ''}
                                    <button onclick="deleteServer('${server.id}', '${server.name}')" class="btn btn-sm btn-danger flex-1">
                                        <i class="fas fa-trash"></i> 删除
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="col-span-full">
                            <div class="empty-state py-12">
                                <i class="fas fa-server empty-icon"></i>
                                <h3 class="empty-title">暂无服务器</h3>
                                <p class="empty-description">您还没有添加任何Minecraft服务器</p>
                                <button onclick="showAddServerModal()" class="btn btn-primary mt-4">
                                    <i class="fas fa-plus"></i> 添加第一个服务器
                                </button>
                            </div>
                        </div>
                    `}
                </div>
            `;
        } else {
            serversGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle empty-icon"></i>
                    <h3 class="empty-title">加载失败</h3>
                    <p class="empty-description">无法加载服务器列表: ${data.message || '未知错误'}</p>
                    <button onclick="loadServersGrid()" class="btn btn-outline mt-4">
                        <i class="fas fa-redo"></i> 重试
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('加载服务器网格失败:', error);
        serversGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle empty-icon"></i>
                <h3 class="empty-title">网络错误</h3>
                <p class="empty-description">无法连接到服务器: ${error.message}</p>
                <button onclick="loadServersGrid()" class="btn btn-outline mt-4">
                    <i class="fas fa-redo"></i> 重试
                </button>
            </div>
        `;
    }
}

// 显示添加服务器模态框
function showAddServerModal() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-plus"></i> 创建新服务器</h3>
                <button class="modal-close" onclick="closeServerModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="space-y-4">
                    <div class="form-group">
                        <label class="form-label">服务器名称 *</label>
                        <input type="text" id="newServerName" class="form-control" placeholder="例如: 生存服务器" required>
                        <small class="form-text">这是显示在面板中的名称</small>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">服务器端口</label>
                            <input type="number" id="newServerPort" class="form-control" value="25565" min="1024" max="65535">
                            <small class="form-text">默认: 25565</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label">最大玩家数</label>
                            <input type="number" id="newServerMaxPlayers" class="form-control" value="20" min="1" max="1000">
                            <small class="form-text">默认: 20</small>
                        </div>
                    </div>
                    
                    <div class="alert alert-info">
                        <div class="alert-content">
                            <i class="fas fa-info-circle"></i>
                            <div>
                                <strong>重要提示</strong>
                                <p class="text-sm">创建服务器后，您需要上传一个有效的 server.jar 文件到服务器文件夹中。</p>
                                <p class="text-sm">可以从 <a href="https://www.minecraft.net/en-us/download/server" target="_blank" class="text-blue-400 hover:underline">Minecraft官网</a> 下载服务器文件。</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeServerModal()">取消</button>
                <button class="btn btn-primary" onclick="addNewServer()" id="addServerBtn">
                    <i class="fas fa-plus"></i> 创建服务器
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 聚焦到输入框
    setTimeout(() => {
        const input = document.getElementById('newServerName');
        if (input) input.focus();
    }, 100);
}

// 关闭服务器模态框
function closeServerModal() {
    const modal = document.querySelector('.modal.show');
    if (modal) modal.remove();
}

// 添加新服务器
async function addNewServer() {
    const name = document.getElementById('newServerName')?.value?.trim();
    const port = document.getElementById('newServerPort')?.value;
    const maxPlayers = document.getElementById('newServerMaxPlayers')?.value;
    const addBtn = document.getElementById('addServerBtn');
    
    if (!name) {
        showNotification('请填写服务器名称', 'error');
        return;
    }
    
    if (addBtn) {
        addBtn.disabled = true;
        addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 创建中...';
    }
    
    try {
        const response = await fetch('/api/servers/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                port: parseInt(port) || 25565,
                maxPlayers: parseInt(maxPlayers) || 20
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('服务器创建成功！现在请上传 server.jar 文件', 'success');
            
            // 关闭模态框
            closeServerModal();
            
            // 刷新服务器列表
            setTimeout(() => {
                loadServersGrid();
                loadServers(); // 刷新顶部选择器
                
                // 显示JAR上传提示
                setTimeout(() => {
                    showUploadJarAfterCreate(data.server.id, data.server.name);
                }, 500);
                
            }, 1000);
            
        } else {
            showNotification(`创建失败: ${data.message}`, 'error');
            if (addBtn) {
                addBtn.disabled = false;
                addBtn.innerHTML = '<i class="fas fa-plus"></i> 创建服务器';
            }
        }
    } catch (error) {
        console.error('添加服务器失败:', error);
        showNotification(`创建失败: ${error.message}`, 'error');
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.innerHTML = '<i class="fas fa-plus"></i> 创建服务器';
        }
    }
}

// 显示创建后的JAR上传模态框
function showUploadJarAfterCreate(serverId, serverName) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'uploadJarModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-upload"></i> 上传 server.jar</h3>
                <button class="modal-close" onclick="closeUploadJarModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="space-y-4">
                    <div class="text-center p-4 border-2 border-dashed border-blue-500 rounded-lg">
                        <i class="fas fa-file-archive text-4xl text-blue-500 mb-4"></i>
                        <h4 class="font-bold mb-2">服务器 "${serverName}" 已创建</h4>
                        <p class="text-sm text-gray-400 mb-4">现在需要上传一个有效的 server.jar 文件才能启动服务器</p>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">选择 server.jar 文件</label>
                        <div class="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                             onclick="openJarFileDialog()"
                             id="jarUploadArea">
                            <i class="fas fa-cloud-upload-alt text-3xl text-gray-500 mb-3"></i>
                            <p class="text-gray-400 mb-2">点击选择 server.jar 文件</p>
                            <p class="text-sm text-gray-500 mb-4">支持 .jar 格式（如 server.jar、paper.jar、mohist.jar 等），最大 1GB</p>
                        </div>
                        <input type="file" id="jarFileInput" accept=".jar" style="display: none;">
                    </div>
                    
                    <div id="jarUploadProgress" style="display: none;">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-sm">上传进度</span>
                            <span class="text-sm" id="jarProgressText">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="jarProgressFill" style="width: 0%"></div>
                        </div>
                    </div>
                    
                    <div id="selectedJarFile" style="display: none;">
                        <div class="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                            <div class="flex items-center gap-3">
                                <i class="fas fa-file-archive text-yellow-500 text-xl"></i>
                                <div>
                                    <div class="font-medium" id="jarFileName"></div>
                                    <div class="text-xs text-gray-500" id="jarFileSize"></div>
                                </div>
                            </div>
                            <button onclick="clearJarSelection()" class="btn btn-sm btn-outline">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="alert alert-info">
                        <div class="alert-content">
                            <i class="fas fa-link"></i>
                            <div>
                                <strong>下载 server.jar</strong>
                                <p class="text-sm">可以从以下地址下载官方服务器文件:</p>
                                <a href="https://www.minecraft.net/en-us/download/server" 
                                   target="_blank" 
                                   class="text-blue-400 hover:underline text-sm">
                                    https://www.minecraft.net/en-us/download/server
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeUploadJarModal()">稍后上传</button>
                <button class="btn btn-primary" onclick="uploadJarFile('${serverId}')" id="uploadJarBtn" disabled>
                    <i class="fas fa-upload"></i> 上传
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 设置文件选择事件
    setupJarFileInput();
}

// 打开文件选择对话框
function openJarFileDialog() {
    const fileInput = document.getElementById('jarFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

// 设置JAR文件输入事件
function setupJarFileInput() {
    const fileInput = document.getElementById('jarFileInput');
    if (fileInput) {
        // 移除现有的事件监听器
        fileInput.onchange = null;
        
        // 添加新的事件监听器
        fileInput.addEventListener('change', function(e) {
            handleJarFileSelect(e);
        });
    }
}

// 处理JAR文件选择
function handleJarFileSelect(event) {
    const fileInput = event.target;
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    
    const file = fileInput.files[0];
    
    // 允许任意的 .jar 文件，不要求必须是 server.jar
    if (!file.name.toLowerCase().endsWith('.jar')) {
        showNotification('请选择 .jar 文件', 'error');
        return;
    }
    
    // 检查文件大小
    if (file.size > 1024 * 1024 * 1024) {
        showNotification('文件太大，最大支持1GB', 'error');
        return;
    }
    
    // 显示选中的文件
    const selectedDiv = document.getElementById('selectedJarFile');
    const fileName = document.getElementById('jarFileName');
    const fileSize = document.getElementById('jarFileSize');
    const uploadBtn = document.getElementById('uploadJarBtn');
    
    if (selectedDiv && fileName && fileSize && uploadBtn) {
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        selectedDiv.style.display = 'block';
        uploadBtn.disabled = false;
    }
}

// 清除JAR文件选择
function clearJarSelection() {
    const fileInput = document.getElementById('jarFileInput');
    const selectedDiv = document.getElementById('selectedJarFile');
    const uploadBtn = document.getElementById('uploadJarBtn');
    
    if (fileInput) fileInput.value = '';
    if (selectedDiv) selectedDiv.style.display = 'none';
    if (uploadBtn) uploadBtn.disabled = true;
}

// 关闭JAR上传模态框
function closeUploadJarModal() {
    const modal = document.getElementById('uploadJarModal');
    if (modal) modal.remove();
}

// 上传JAR文件
async function uploadJarFile(serverId) {
    const fileInput = document.getElementById('jarFileInput');
    const progressDiv = document.getElementById('jarUploadProgress');
    const progressFill = document.getElementById('jarProgressFill');
    const progressText = document.getElementById('jarProgressText');
    const uploadBtn = document.getElementById('uploadJarBtn');
    
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        showNotification('请先选择JAR文件', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    
    // 允许任意的 .jar 文件，不要求必须是 server.jar
    if (!file.name.toLowerCase().endsWith('.jar')) {
        showNotification('请选择 .jar 文件', 'error');
        return;
    }
    
    // 检查文件大小
    if (file.size > 1024 * 1024 * 1024) {
        showNotification('文件太大，最大支持1GB', 'error');
        return;
    }
    
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';
    }
    
    if (progressDiv) {
        progressDiv.style.display = 'block';
    }
    
    const formData = new FormData();
    formData.append('serverJar', file);
    formData.append('serverId', serverId);
    
    try {
        // 模拟上传进度
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 90) {
                clearInterval(progressInterval);
            }
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${progress}%`;
        }, 200);
        
        const response = await fetch('/api/servers/upload-jar', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('服务器JAR文件上传成功！', 'success');
            
            // 关闭模态框
            closeUploadJarModal();
            
            // 刷新服务器列表
            setTimeout(() => {
                loadServersGrid();
                loadServers();
            }, 1000);
        } else {
            showNotification(`上传失败: ${data.message}`, 'error');
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传';
            }
        }
    } catch (error) {
        console.error('上传JAR文件失败:', error);
        showNotification(`上传失败: ${error.message}`, 'error');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传';
        }
    }
}

// ==================== 上传服务器JAR函数（简化版）====================
function uploadServerJar(serverId) {
    // 这里不需要serverName参数，只保留serverId
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-upload"></i> 上传服务器文件</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="space-y-4">
                    <div class="form-group">
                        <label class="form-label">选择服务器文件 (.jar)</label>
                        <div class="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                             onclick="document.getElementById('serverJarFileInput').click()"
                             id="serverJarUploadArea">
                            <i class="fas fa-cloud-upload-alt text-3xl text-gray-500 mb-3"></i>
                            <p class="text-gray-400 mb-2">点击选择服务器文件</p>
                            <p class="text-sm text-gray-500 mb-4">支持 .jar 格式（如 mohist.jar、paper.jar、server.jar 等），最大 1GB</p>
                            <input type="file" id="serverJarFileInput" accept=".jar" class="hidden">
                        </div>
                    </div>
                    
                    <div id="serverJarUploadProgress" class="hidden">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-sm">上传进度</span>
                            <span class="text-sm" id="serverJarProgressText">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="serverJarProgressFill" style="width: 0%"></div>
                        </div>
                    </div>
                    
                    <div id="serverJarFileInfo" class="hidden">
                        <div class="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                            <div class="flex items-center gap-2">
                                <i class="fas fa-file-archive text-yellow-500 text-xl"></i>
                                <div>
                                    <div class="text-sm font-medium truncate max-w-xs" id="serverJarFileName"></div>
                                    <div class="text-xs text-gray-500" id="serverJarFileSize"></div>
                                </div>
                            </div>
                            <button onclick="clearServerJarSelection()" class="btn btn-sm btn-outline">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                <button class="btn btn-primary" onclick="uploadServerJarFile('${serverId}')" id="uploadServerJarBtn" disabled>
                    <i class="fas fa-upload"></i> 上传
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 设置文件选择事件
    const fileInput = document.getElementById('serverJarFileInput');
    const uploadArea = document.getElementById('serverJarUploadArea');
    
    if (fileInput && uploadArea) {
        fileInput.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                
                // 检查文件类型 - 允许任何.jar文件
                if (!file.name.toLowerCase().endsWith('.jar')) {
                    showNotification('请选择 .jar 文件', 'error');
                    this.value = ''; // 清空选择
                    return;
                }
                
                // 检查文件大小
                if (file.size > 1024 * 1024 * 1024) {
                    showNotification('文件太大，最大支持1GB', 'error');
                    this.value = ''; // 清空选择
                    return;
                }
                
                // 显示文件信息
                document.getElementById('serverJarFileName').textContent = file.name;
                document.getElementById('serverJarFileSize').textContent = formatFileSize(file.size);
                document.getElementById('serverJarFileInfo').classList.remove('hidden');
                
                // 启用上传按钮
                document.getElementById('uploadServerJarBtn').disabled = false;
            }
        });
    }
}

// 清空文件选择
function clearServerJarSelection() {
    const fileInput = document.getElementById('serverJarFileInput');
    if (fileInput) {
        fileInput.value = '';
    }
    
    document.getElementById('serverJarFileInfo').classList.add('hidden');
    document.getElementById('uploadServerJarBtn').disabled = true;
}

// 上传服务器JAR文件
async function uploadServerJarFile(serverId) {
    const fileInput = document.getElementById('serverJarFileInput');
    
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        showNotification('请先选择服务器文件', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    const uploadBtn = document.getElementById('uploadServerJarBtn');
    const progressDiv = document.getElementById('serverJarUploadProgress');
    const progressFill = document.getElementById('serverJarProgressFill');
    const progressText = document.getElementById('serverJarProgressText');
    
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';
    }
    
    if (progressDiv) {
        progressDiv.classList.remove('hidden');
    }
    
    const formData = new FormData();
    formData.append('serverJar', file);
    formData.append('serverId', serverId);
    
    try {
        // 模拟上传进度
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 90) {
                clearInterval(progressInterval);
            }
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${progress}%`;
        }, 200);
        
        const response = await fetch('/api/servers/upload-jar', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('服务器文件上传成功！', 'success');
            
            // 关闭模态框
            document.querySelector('.modal.show')?.remove();
            
            // 刷新服务器列表
            setTimeout(() => {
                loadServersGrid();
                loadServers();
            }, 1000);
        } else {
            showNotification(`上传失败: ${data.message}`, 'error');
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传';
            }
        }
    } catch (error) {
        console.error('上传服务器文件失败:', error);
        showNotification(`上传失败: ${error.message}`, 'error');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传';
        }
    }
}

async function deleteServer(serverId, serverName) {
    if (!confirm(`确定要删除服务器 "${serverName}" 吗？\n\n此操作将删除服务器文件夹及其所有文件，包括世界存档、插件等。\n此操作不可恢复！`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/servers/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverId: serverId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`服务器 "${serverName}" 已删除`, 'success');
            
            // 如果删除的是当前选中的服务器，清空选择
            if (currentServer && currentServer.id === serverId) {
                currentServer = null;
                updateCurrentServerInfo();
            }
            
            // 刷新服务器列表
            setTimeout(() => {
                loadServersGrid();
                loadServers();
            }, 500);
        } else {
            showNotification(`删除失败: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('删除服务器失败:', error);
        showNotification(`删除失败: ${error.message}`, 'error');
    }
}

// 新增服务器操作函数
async function refreshServerList() {
    console.log('刷新服务器列表...');
    const serversGrid = document.getElementById('serversGrid');
    if (serversGrid) {
        serversGrid.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <div class="loading-text">刷新服务器列表...</div>
            </div>
        `;
        await loadServersGrid();
    }
}

function selectServer(serverId) {
    const serverSelect = document.getElementById('serverSelect');
    if (serverSelect) {
        serverSelect.value = serverId;
        serverSelect.dispatchEvent(new Event('change'));
    }
}

// ==================== 模组管理相关函数 ====================
function showUploadModModal() {
    // 重置上传区域
    const uploadArea = document.getElementById('modUploadArea');
    if (uploadArea) {
        uploadArea.className = 'border-2 border-dashed border-gray-600 rounded-lg p-6 text-center';
    }
    
    const progressDiv = document.getElementById('modUploadProgress');
    if (progressDiv) {
        progressDiv.style.display = 'none';
    }
    
    const selectedFiles = document.getElementById('modSelectedFiles');
    if (selectedFiles) {
        selectedFiles.style.display = 'none';
    }
    
    const fileList = document.getElementById('modFileList');
    if (fileList) {
        fileList.innerHTML = '';
    }
    
    // 显示模态框
    const modal = document.getElementById('uploadModModal');
    if (modal) {
        modal.style.display = 'flex';
    }
    
    // 设置文件选择事件
    const fileInput = document.getElementById('modFileInput');
    if (fileInput) {
        fileInput.onchange = handleModFileSelect;
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function handleModFileSelect(event) {
    const fileInput = event.target || document.getElementById('modFileInput');
    const fileList = document.getElementById('modFileList');
    const selectedFiles = document.getElementById('modSelectedFiles');
    
    if (!fileInput || !fileInput.files || !fileInput.files.length) return;
    
    if (fileList) {
        fileList.innerHTML = '';
    }
    
    Array.from(fileInput.files).forEach((file, index) => {
        const fileName = file.name.toLowerCase();
        // 修复：只检查文件扩展名是否为 .jar
        if (!fileName.endsWith('.jar')) {
            showNotification(`文件 ${file.name} 不是 .jar 格式`, 'error');
            return;
        }
        
        // 检查文件大小 - 1GB
        if (file.size > 1024 * 1024 * 1024) {
            showNotification(`文件 ${file.name} 太大，最大支持1GB`, 'error');
            return;
        }
        
        if (!fileList) return;
        
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2';
        li.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas fa-file-archive text-yellow-500"></i>
                <div>
                    <div class="text-sm font-medium">${file.name}</div>
                    <div class="text-xs text-gray-500">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button onclick="removeModFile(${index})" class="btn btn-sm btn-outline">
                <i class="fas fa-times"></i>
            </button>
        `;
        fileList.appendChild(li);
    });
    
    if (selectedFiles && fileList.children.length > 0) {
        selectedFiles.style.display = 'block';
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.add('border-blue-500', 'bg-gray-900');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.remove('border-blue-500', 'bg-gray-900');
}

function handleModDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.target.classList.remove('border-blue-500', 'bg-gray-900');
    
    const fileInput = document.getElementById('modFileInput');
    const files = event.dataTransfer.files;
    
    if (files.length > 0 && fileInput) {
        // 创建新的 FileList
        const dataTransfer = new DataTransfer();
        Array.from(files).forEach(file => {
            const fileName = file.name.toLowerCase();
            // 修复：只检查文件扩展名是否为 .jar
            if (fileName.endsWith('.jar')) {
                // 检查文件大小 - 1GB
                if (file.size > 1024 * 1024 * 1024) {
                    showNotification(`文件 ${file.name} 太大，最大支持1GB`, 'error');
                    return;
                }
                dataTransfer.items.add(file);
            } else {
                showNotification(`文件 ${file.name} 不是 .jar 格式`, 'error');
            }
        });
        
        if (dataTransfer.files.length > 0) {
            fileInput.files = dataTransfer.files;
            handleModFileSelect({ target: fileInput });
        } else {
            showNotification('请选择有效的 .jar 文件', 'error');
        }
    }
}

function removeModFile(index) {
    const fileInput = document.getElementById('modFileInput');
    if (!fileInput) return;
    
    const files = Array.from(fileInput.files);
    
    if (index >= 0 && index < files.length) {
        files.splice(index, 1);
        
        // 创建新的 FileList
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;
        
        // 重新渲染文件列表
        handleModFileSelect({ target: fileInput });
        
        if (files.length === 0) {
            const selectedFiles = document.getElementById('modSelectedFiles');
            if (selectedFiles) {
                selectedFiles.style.display = 'none';
            }
        }
    }
}

async function uploadMods() {
    const fileInput = document.getElementById('modFileInput');
    const progressDiv = document.getElementById('modUploadProgress');
    const progressFill = document.getElementById('modProgressFill');
    const progressText = document.getElementById('modProgressText');
    const uploadStatus = document.getElementById('modUploadStatus');
    const uploadBtn = document.getElementById('modUploadBtn');
    
    if (!fileInput || !fileInput.files.length || !currentServer) {
        showNotification('请先选择要上传的模组文件', 'error');
        return;
    }
    
    // 检查文件类型 - 修复：只检查扩展名
    const invalidFiles = Array.from(fileInput.files).filter(file => {
        const fileName = file.name.toLowerCase();
        return !fileName.endsWith('.jar');
    });
    
    if (invalidFiles.length > 0) {
        showNotification('只能上传 .jar 格式的模组文件', 'error');
        return;
    }
    
    // 显示进度条
    if (progressDiv) progressDiv.style.display = 'block';
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 上传中...';
    }
    
    const formData = new FormData();
    formData.append('serverPath', currentServer.path);
    formData.append('targetPath', 'mods');
    
    Array.from(fileInput.files).forEach(file => {
        formData.append('files', file);
    });
    
    try {
        // 模拟上传进度（实际应用中应使用XMLHttpRequest或fetch的progress事件）
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${progress}%`;
            
            if (progress >= 90) {
                clearInterval(progressInterval);
                if (uploadStatus) uploadStatus.textContent = '正在处理...';
            }
        }, 200);
        
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        
        const data = await response.json();
        
        if (data.success) {
            if (progressFill) progressFill.style.width = '100%';
            if (progressText) progressText.textContent = '100%';
            if (uploadStatus) uploadStatus.textContent = '上传完成！';
            
            showNotification(`成功上传 ${data.files?.length || 0} 个模组文件`, 'success');
            
            // 关闭模态框
            setTimeout(() => {
                closeModal('uploadModModal');
                refreshModList();
            }, 1500);
        } else {
            showNotification(`上传失败: ${data.message}`, 'error');
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-upload mr-2"></i> 上传';
            }
        }
    } catch (error) {
        console.error('上传模组失败:', error);
        showNotification(`上传失败: ${error.message}`, 'error');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload mr-2"></i> 上传';
        }
    }
}

function refreshModList() {
    if (currentPage === 'mods') {
        loadPage('mods');
    }
}

// 模组操作函数
async function enableMod(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/mods/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                filename: filename
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('模组已启用', 'success');
            setTimeout(refreshModList, 1000);
        } else {
            showNotification(data.message || '启用模组失败', 'error');
        }
    } catch (error) {
        console.error('启用模组失败:', error);
        showNotification('启用模组失败: ' + error.message, 'error');
    }
}

async function disableMod(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    if (!confirm('确定要禁用这个模组吗？')) {
        return;
    }
    
    try {
        const response = await fetch('/api/mods/disable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                filename: filename
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('模组已禁用', 'success');
            setTimeout(refreshModList, 1000);
        } else {
            showNotification(data.message || '禁用模组失败', 'error');
        }
    } catch (error) {
        console.error('禁用模组失败:', error);
        showNotification('禁用模组失败: ' + error.message, 'error');
    }
}

async function deleteMod(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    if (!confirm(`确定要删除模组 "${filename}" 吗？此操作不可恢复。`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/mods/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                filename: filename
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('模组已删除', 'success');
            setTimeout(refreshModList, 1000);
        } else {
            showNotification(data.message || '删除模组失败', 'error');
        }
    } catch (error) {
        console.error('删除模组失败:', error);
        showNotification('删除模组失败: ' + error.message, 'error');
    }
}

// ==================== 插件管理相关函数 ====================
// 插件上传相关函数
function showUploadPluginModal() {
    const modal = document.getElementById('uploadPluginModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // 重置状态
        resetPluginUploadForm();
        
        // 设置文件输入事件
        setTimeout(() => {
            setupPluginFileInput();
        }, 100);
    }
}

// 关闭插件模态框
function closePluginModal() {
    const modal = document.getElementById('uploadPluginModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 重置插件上传表单
function resetPluginUploadForm() {
    const fileInput = document.getElementById('pluginFileInput');
    const selectedDiv = document.getElementById('selectedPluginFiles');
    const fileList = document.getElementById('pluginFileList');
    const uploadBtn = document.getElementById('uploadPluginBtn');
    const progressDiv = document.getElementById('pluginUploadProgress');
    
    if (fileInput) fileInput.value = '';
    if (selectedDiv) selectedDiv.style.display = 'none';
    if (fileList) fileList.innerHTML = '';
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传';
    }
    if (progressDiv) progressDiv.style.display = 'none';
}

// 打开插件文件选择对话框
function openPluginFileDialog() {
    const fileInput = document.getElementById('pluginFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

// 设置插件文件输入事件
function setupPluginFileInput() {
    const fileInput = document.getElementById('pluginFileInput');
    if (fileInput) {
        // 移除现有的事件监听器
        fileInput.onchange = null;
        
        // 添加新的事件监听器
        fileInput.addEventListener('change', function(e) {
            handlePluginFileSelect(e);
        });
    }
}

// 处理插件文件选择
function handlePluginFileSelect(event) {
    const fileInput = event.target;
    if (!fileInput || !fileInput.files || !fileInput.files.length) return;
    
    const files = Array.from(fileInput.files);
    const fileList = document.getElementById('pluginFileList');
    const selectedDiv = document.getElementById('selectedPluginFiles');
    const uploadBtn = document.getElementById('uploadPluginBtn');
    
    if (!fileList || !selectedDiv || !uploadBtn) return;
    
    // 清空之前的文件列表
    fileList.innerHTML = '';
    
    let hasInvalidFile = false;
    let totalSize = 0;
    
    // 检查每个文件
    files.forEach((file, index) => {
        // 检查文件类型
        if (!file.name.toLowerCase().endsWith('.jar')) {
            showNotification(`文件 ${file.name} 不是 .jar 格式`, 'error');
            hasInvalidFile = true;
            return;
        }
        
        // 检查文件大小
        if (file.size > 1024 * 1024 * 1024) {
            showNotification(`文件 ${file.name} 太大，最大支持1GB`, 'error');
            hasInvalidFile = true;
            return;
        }
        
        totalSize += file.size;
        
        // 添加到文件列表
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2';
        fileItem.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fas fa-file-archive text-yellow-500"></i>
                <div>
                    <div class="text-sm font-medium truncate max-w-xs">${file.name}</div>
                    <div class="text-xs text-gray-500">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button onclick="removePluginFile(${index})" class="btn btn-sm btn-outline">
                <i class="fas fa-times"></i>
            </button>
        `;
        fileList.appendChild(fileItem);
    });
    
    if (hasInvalidFile) {
        return;
    }
    
    // 显示总大小
    const totalSizeElement = document.createElement('div');
    totalSizeElement.className = 'text-xs text-gray-500 mt-2 text-center';
    totalSizeElement.textContent = `总大小: ${formatFileSize(totalSize)}`;
    fileList.appendChild(totalSizeElement);
    
    // 显示文件列表
    selectedDiv.style.display = 'block';
    uploadBtn.disabled = false;
}

// 移除插件文件
function removePluginFile(index) {
    const fileInput = document.getElementById('pluginFileInput');
    if (!fileInput) return;
    
    const files = Array.from(fileInput.files);
    
    if (index >= 0 && index < files.length) {
        // 移除文件
        files.splice(index, 1);
        
        // 创建新的 FileList
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;
        
        // 重新渲染文件列表
        handlePluginFileSelect({ target: fileInput });
    }
}

// 上传插件文件
async function uploadPluginFiles() {
    const fileInput = document.getElementById('pluginFileInput');
    const uploadBtn = document.getElementById('uploadPluginBtn');
    const progressDiv = document.getElementById('pluginUploadProgress');
    const progressFill = document.getElementById('pluginProgressFill');
    const progressText = document.getElementById('pluginProgressText');
    
    if (!fileInput || !fileInput.files || !fileInput.files.length || !currentServer) {
        showNotification('请先选择要上传的插件文件', 'error');
        return;
    }
    
    const files = Array.from(fileInput.files);
    
    // 再次检查文件
    for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.jar')) {
            showNotification(`文件 ${file.name} 不是 .jar 格式`, 'error');
            return;
        }
        
        if (file.size > 1024 * 1024 * 1024) {
            showNotification(`文件 ${file.name} 太大，最大支持1GB`, 'error');
            return;
        }
    }
    
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';
    }
    
    if (progressDiv) {
        progressDiv.style.display = 'block';
    }
    
    const formData = new FormData();
    formData.append('serverPath', currentServer.path);
    formData.append('targetPath', 'plugins');
    
    files.forEach(file => {
        formData.append('files', file);
    });
    
    try {
        // 模拟上传进度
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 90) {
                clearInterval(progressInterval);
            }
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${progress}%`;
        }, 200);
        
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`成功上传 ${data.files?.length || 0} 个插件文件`, 'success');
            
            // 关闭模态框
            closePluginModal();
            
            // 刷新插件列表
            setTimeout(() => {
                refreshPluginList();
            }, 1000);
        } else {
            showNotification(`上传失败: ${data.message}`, 'error');
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传';
            }
        }
    } catch (error) {
        console.error('上传插件失败:', error);
        showNotification(`上传失败: ${error.message}`, 'error');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传';
        }
    }
}

// 刷新插件列表
function refreshPluginList() {
    if (currentPage === 'plugins') {
        loadPage('plugins');
    }
}

// 插件操作函数
async function enablePlugin(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/plugins/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                filename: filename
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('插件已启用', 'success');
            setTimeout(() => {
                if (currentPage === 'plugins') {
                    loadPage('plugins');
                }
            }, 1000);
        } else {
            showNotification(data.message || '启用插件失败', 'error');
        }
    } catch (error) {
        console.error('启用插件失败:', error);
        showNotification('启用插件失败: ' + error.message, 'error');
    }
}

async function disablePlugin(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    if (!confirm('确定要禁用这个插件吗？')) {
        return;
    }
    
    try {
        const response = await fetch('/api/plugins/disable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                filename: filename
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('插件已禁用', 'success');
            setTimeout(() => {
                if (currentPage === 'plugins') {
                    loadPage('plugins');
                }
            }, 1000);
        } else {
            showNotification(data.message || '禁用插件失败', 'error');
        }
    } catch (error) {
        console.error('禁用插件失败:', error);
        showNotification('禁用插件失败: ' + error.message, 'error');
    }
}

async function deletePlugin(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    if (!confirm(`确定要删除插件 "${filename}" 吗？此操作不可恢复。`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/plugins/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                filename: filename
            })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('插件已删除', 'success');
            setTimeout(() => {
                if (currentPage === 'plugins') {
                    loadPage('plugins');
                }
            }, 1000);
        } else {
            showNotification(data.message || '删除插件失败', 'error');
        }
    } catch (error) {
        console.error('删除插件失败:', error);
        showNotification('删除插件失败: ' + error.message, 'error');
    }
}

// 批量插件操作
async function enableAllPlugins() {
    if (!currentServer || !confirm('确定要启用所有插件吗？')) {
        return;
    }
    
    showNotification('批量启用插件功能开发中', 'info');
}

async function disableAllPlugins() {
    if (!currentServer || !confirm('确定要禁用所有插件吗？')) {
        return;
    }
    
    showNotification('批量禁用插件功能开发中', 'info');
}

async function reloadAllPlugins() {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    sendCommand('reload');
    showNotification('已发送重载插件命令', 'info');
}

// ==================== 文件管理相关函数 ====================
function navigateToPath(newPath) {
    // 保存当前路径到全局变量
    window.currentFilePath = newPath;
    
    // 重新加载文件页面
    if (currentPage === 'files') {
        loadPage('files');
    }
}

// 显示文件上传模态框
function showFileUploadModal() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-upload"></i> 上传文件</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="space-y-4">
                    <div class="form-group">
                        <label class="form-label">选择文件</label>
                        <div class="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                             onclick="document.getElementById('fileUploadInput').click()"
                             id="fileUploadArea">
                            <i class="fas fa-cloud-upload-alt text-3xl text-gray-500 mb-3"></i>
                            <p class="text-gray-400 mb-2">点击选择文件，或拖拽文件到这里</p>
                            <p class="text-sm text-gray-500 mb-4">支持各种格式，单个文件最大 1GB，最多10个文件</p>
                            <input type="file" id="fileUploadInput" multiple class="hidden">
                        </div>
                    </div>
                    
                    <div id="fileUploadList" class="hidden">
                        <h4 class="mb-2 font-medium">已选择文件:</h4>
                        <div class="max-h-60 overflow-y-auto space-y-2" id="fileListContainer"></div>
                    </div>
                    
                    <div id="fileUploadProgress" class="hidden">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-sm">上传进度</span>
                            <span class="text-sm" id="fileProgressText">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" id="fileProgressFill" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                <button class="btn btn-primary" onclick="uploadSelectedFiles()" id="uploadFilesBtn" disabled>
                    <i class="fas fa-upload"></i> 上传
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 设置文件选择事件
    const fileInput = document.getElementById('fileUploadInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }
}

// 处理文件选择
function handleFileSelection(event) {
    const fileInput = event.target;
    const fileListContainer = document.getElementById('fileListContainer');
    const fileUploadList = document.getElementById('fileUploadList');
    const uploadBtn = document.getElementById('uploadFilesBtn');
    
    if (!fileInput || !fileInput.files || !fileInput.files.length) return;
    
    // 检查文件数量
    if (fileInput.files.length > 10) {
        showNotification('最多只能上传10个文件', 'error');
        return;
    }
    
    // 显示文件列表
    if (fileListContainer && fileUploadList) {
        fileListContainer.innerHTML = '';
        
        let totalSize = 0;
        let allFilesValid = true;
        
        Array.from(fileInput.files).forEach((file, index) => {
            // 检查文件大小
            if (file.size > 1024 * 1024 * 1024) {
                showNotification(`文件 ${file.name} 太大，最大支持1GB`, 'error');
                allFilesValid = false;
                return;
            }
            
            totalSize += file.size;
            
            const fileItem = document.createElement('div');
            fileItem.className = 'flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2';
            fileItem.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fas ${getFileIcon(file.name)}"></i>
                    <div>
                        <div class="text-sm font-medium truncate max-w-xs">${file.name}</div>
                        <div class="text-xs text-gray-500">${formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button onclick="removeFileFromList(${index})" class="btn btn-sm btn-outline">
                    <i class="fas fa-times"></i>
                </button>
            `;
            fileListContainer.appendChild(fileItem);
        });
        
        if (allFilesValid && fileInput.files.length > 0) {
            fileUploadList.classList.remove('hidden');
            
            // 显示总大小
            const totalSizeElement = document.createElement('div');
            totalSizeElement.className = 'text-xs text-gray-500 mt-2';
            totalSizeElement.textContent = `总大小: ${formatFileSize(totalSize)}`;
            fileListContainer.appendChild(totalSizeElement);
            
            // 启用上传按钮
            if (uploadBtn) {
                uploadBtn.disabled = false;
            }
        }
    }
}

// 从列表中移除文件
function removeFileFromList(index) {
    const fileInput = document.getElementById('fileUploadInput');
    if (!fileInput) return;
    
    const files = Array.from(fileInput.files);
    
    if (index >= 0 && index < files.length) {
        files.splice(index, 1);
        
        // 创建新的 FileList
        const dataTransfer = new DataTransfer();
        files.forEach(file => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;
        
        // 重新渲染文件列表
        handleFileSelection({ target: fileInput });
        
        if (files.length === 0) {
            const fileUploadList = document.getElementById('fileUploadList');
            if (fileUploadList) {
                fileUploadList.classList.add('hidden');
            }
            const uploadBtn = document.getElementById('uploadFilesBtn');
            if (uploadBtn) {
                uploadBtn.disabled = true;
            }
        }
    }
}

// 获取文件图标
function getFileIcon(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    switch(ext) {
        case 'jar': return 'fa-file-archive text-yellow-500';
        case 'zip': case 'rar': case '7z': return 'fa-file-archive text-red-500';
        case 'txt': case 'log': return 'fa-file-alt text-gray-500';
        case 'yml': case 'yaml': return 'fa-file-code text-green-500';
        case 'json': return 'fa-file-code text-yellow-500';
        case 'properties': return 'fa-file-code text-blue-500';
        case 'dat': case 'mca': case 'nbt': return 'fa-file text-purple-500';
        case 'png': case 'jpg': case 'jpeg': case 'gif': return 'fa-file-image text-pink-500';
        default: return 'fa-file text-gray-400';
    }
}

// 上传选中的文件
async function uploadSelectedFiles() {
    const fileInput = document.getElementById('fileUploadInput');
    const uploadBtn = document.getElementById('uploadFilesBtn');
    const progressDiv = document.getElementById('fileUploadProgress');
    const progressFill = document.getElementById('fileProgressFill');
    const progressText = document.getElementById('fileProgressText');
    
    if (!fileInput || !fileInput.files || !fileInput.files.length || !currentServer) {
        showNotification('请先选择要上传的文件', 'error');
        return;
    }
    
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';
    }
    
    if (progressDiv) {
        progressDiv.classList.remove('hidden');
    }
    
    // 获取当前路径
    const currentPath = window.currentFilePath || '/';
    
    const formData = new FormData();
    formData.append('serverPath', currentServer.path);
    formData.append('targetPath', currentPath);
    
    Array.from(fileInput.files).forEach(file => {
        formData.append('files', file);
    });
    
    try {
        // 模拟上传进度
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 90) {
                clearInterval(progressInterval);
            }
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${progress}%`;
        }, 200);
        
        const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`成功上传 ${data.files?.length || 0} 个文件`, 'success');
            
            // 关闭模态框
            document.querySelector('.modal.show')?.remove();
            
            // 刷新文件列表
            setTimeout(() => {
                if (currentPage === 'files') {
                    loadPage('files');
                }
            }, 1000);
        } else {
            showNotification(`上传失败: ${data.message}`, 'error');
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传';
            }
        }
    } catch (error) {
        console.error('上传文件失败:', error);
        showNotification(`上传失败: ${error.message}`, 'error');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> 上传';
        }
    }
}

// ==================== 文本文件编辑功能 ====================

// 打开文本编辑器
async function openTextEditor(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    try {
        const currentPath = window.currentFilePath || '/';
        const filePath = currentPath === '/' ? filename : `${currentPath}/${filename}`;
        
        const response = await fetch(`/api/files?serverPath=${encodeURIComponent(currentServer.path)}&path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.success) {
            if (data.isDirectory) {
                showNotification('不能编辑文件夹', 'error');
                return;
            }
            
            // 检查文件大小（限制为1MB以内的文本文件）
            const sizeResponse = await fetch(`/api/files/size?serverPath=${encodeURIComponent(currentServer.path)}&filePath=${encodeURIComponent(filePath)}`);
            const sizeData = await sizeResponse.json();
            
            if (sizeData.success && sizeData.size > 1024 * 1024) {
                showNotification('文件太大（超过1MB），请使用下载功能', 'warning');
                return;
            }
            
            // 显示文本编辑器模态框
            showTextEditorModal(filename, data.content, filePath);
        } else {
            showNotification('无法读取文件', 'error');
        }
    } catch (error) {
        console.error('打开文本编辑器失败:', error);
        showNotification(`打开失败: ${error.message}`, 'error');
    }
}

// 显示文本编辑器模态框（增强版）
function showTextEditorModal(filename, content, filePath) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; width: 90vw; height: 80vh;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-edit"></i> 编辑文件: ${filename}</h3>
                <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-400" id="fileInfo">${formatFileSize(content.length)} - 正在编辑...</span>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
            </div>
            <div class="modal-body flex flex-col h-full">
                <div class="mb-4 flex items-center justify-between">
                    <div class="flex gap-2">
                        <button onclick="saveTextFile('${filePath}')" class="btn btn-primary">
                            <i class="fas fa-save"></i> 保存
                        </button>
                        <button onclick="downloadTextFile('${filePath}', '${filename}')" class="btn btn-outline">
                            <i class="fas fa-download"></i> 下载
                        </button>
                        <button onclick="showEditorSettings()" class="btn btn-outline">
                            <i class="fas fa-cog"></i> 设置
                        </button>
                    </div>
                    <div class="flex items-center gap-2 text-sm">
                        <button onclick="toggleWordWrap()" class="btn btn-sm btn-outline" id="wordWrapBtn">
                            <i class="fas fa-text-width"></i> 自动换行
                        </button>
                    </div>
                </div>
                
                <div class="flex-1 relative border border-gray-800 rounded overflow-hidden">
                    <div id="editorContainer" class="absolute inset-0">
                        <textarea id="textEditor" 
                                  class="w-full h-full bg-black text-gray-200 font-mono p-4 resize-none focus:outline-none leading-relaxed"
                                  spellcheck="false"
                                  placeholder="输入文件内容..."
                                  style="font-family: 'Consolas', 'Monaco', 'Courier New', monospace; tab-size: 2; font-size: 14px;">${escapeHtml(content || '')}</textarea>
                    </div>
                </div>
                
                <div class="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <div>
                        行: <span id="lineCount">1</span> | 
                        列: <span id="colCount">1</span> |
                        字符: <span id="charCount">0</span> |
                        编码: UTF-8
                    </div>
                    <div id="editorStatus" class="text-green-500">
                        <i class="fas fa-check"></i> 就绪
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i> 取消
                </button>
                <button class="btn btn-primary" onclick="saveTextFile('${filePath}')">
                    <i class="fas fa-save"></i> 保存更改
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 初始化编辑器
    setTimeout(() => {
        initTextEditor();
        
        // 更新文件信息
        updateEditorStats();
        
        // 设置状态保存
        setupEditorState();
    }, 100);
}

// 更新编辑器统计信息
function updateEditorStats() {
    const textarea = document.getElementById('textEditor');
    if (!textarea) return;
    
    const content = textarea.value;
    const charCount = content.length;
    const lines = content.split('\n');
    const lineCount = lines.length;
    
    // 获取当前光标位置
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.substring(0, cursorPos);
    const currentLine = textBeforeCursor.split('\n').length;
    const currentCol = cursorPos - textBeforeCursor.lastIndexOf('\n');
    
    document.getElementById('charCount').textContent = charCount;
    document.getElementById('lineCount').textContent = lineCount;
    document.getElementById('colCount').textContent = currentCol;
    
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.textContent = `${charCount} 字符, ${lineCount} 行`;
    }
}

// 设置编辑器状态保存
function setupEditorState() {
    const textarea = document.getElementById('textEditor');
    if (!textarea) return;
    
    // 监听所有变化
    let saveTimeout;
    
    textarea.addEventListener('input', function() {
        updateEditorStats();
        
        // 更新状态为已修改
        const status = document.getElementById('editorStatus');
        if (status) {
            status.innerHTML = '<i class="fas fa-pen text-yellow-500"></i> 已修改';
            status.className = 'text-yellow-500';
        }
        
        // 清除之前的保存定时器
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
    });
    
    textarea.addEventListener('keyup', function(event) {
        // 更新光标位置
        updateEditorStats();
    });
    
    textarea.addEventListener('click', function() {
        updateEditorStats();
    });
}

// 切换自动换行
function toggleWordWrap() {
    const textarea = document.getElementById('textEditor');
    const button = document.getElementById('wordWrapBtn');
    
    if (textarea && button) {
        if (textarea.style.whiteSpace === 'nowrap') {
            textarea.style.whiteSpace = 'pre-wrap';
            textarea.style.wordWrap = 'break-word';
            button.innerHTML = '<i class="fas fa-text-width"></i> 自动换行';
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline');
        } else {
            textarea.style.whiteSpace = 'nowrap';
            textarea.style.wordWrap = 'normal';
            button.innerHTML = '<i class="fas fa-text-width"></i> 不换行';
            button.classList.remove('btn-outline');
            button.classList.add('btn-primary');
        }
    }
}

// 更新编辑器字体大小
function updateEditorFontSize(size) {
    const textarea = document.getElementById('textEditor');
    if (textarea) {
        textarea.style.fontSize = `${size}px`;
        showNotification(`字体大小已设置为 ${size}px`, 'info');
    }
}

// 更新编辑器主题
function updateEditorTheme(theme) {
    const textarea = document.getElementById('textEditor');
    if (textarea) {
        if (theme === 'dark') {
            // 暗色主题 - 黑色背景
            textarea.classList.remove('bg-gray-800', 'text-gray-900');
            textarea.classList.add('bg-black', 'text-gray-200');
            textarea.style.backgroundColor = '#000000';
            textarea.style.color = '#e5e7eb';
            showNotification('已切换到暗色主题', 'info');
        } else if (theme === 'dark-gray') {
            // 深灰主题
            textarea.classList.remove('bg-black', 'bg-white', 'text-gray-900');
            textarea.classList.add('bg-gray-900', 'text-gray-200');
            textarea.style.backgroundColor = '#111827';
            textarea.style.color = '#e5e7eb';
            showNotification('已切换到深灰主题', 'info');
        } else {
            // 亮色主题
            textarea.classList.remove('bg-black', 'bg-gray-900', 'text-gray-200');
            textarea.classList.add('bg-white', 'text-gray-900');
            textarea.style.backgroundColor = '#ffffff';
            textarea.style.color = '#111827';
            showNotification('已切换到亮色主题', 'info');
        }
    }
}

// 更新字体家族
function updateEditorFontFamily(fontFamily) {
    const textarea = document.getElementById('textEditor');
    if (textarea) {
        textarea.style.fontFamily = `${fontFamily}, 'Consolas', 'Monaco', 'Courier New', monospace`;
        showNotification(`字体已设置为 ${fontFamily}`, 'info');
    }
}

// 更新Tab缩进大小
function updateTabSize(size) {
    const textarea = document.getElementById('textEditor');
    if (textarea) {
        if (size === 'tab') {
            textarea.style.tabSize = '4';
            showNotification('Tab键使用制表符', 'info');
        } else {
            textarea.style.tabSize = size;
            showNotification(`Tab键使用 ${size} 个空格`, 'info');
        }
    }
}

// 切换行号显示
function toggleLineNumbers(show) {
    showNotification(show ? '已启用行号（功能开发中）' : '已禁用行号（功能开发中）', 'info');
}

// 切换空格显示
function toggleWhitespace(show) {
    const textarea = document.getElementById('textEditor');
    if (textarea) {
        if (show) {
            // 用·显示空格，用→显示制表符
            const content = textarea.value
                .replace(/ /g, '·')
                .replace(/\t/g, '→');
            textarea.value = content;
            showNotification('已显示空格和制表符', 'info');
        } else {
            showNotification('要禁用空格显示，请重新打开文件', 'warning');
        }
    }
}

// 保存编辑器设置到localStorage
function saveEditorSettings() {
    const settings = {
        fontSize: document.getElementById('editorFontSize').value,
        theme: document.getElementById('editorTheme').value,
        fontFamily: document.getElementById('editorFontFamily').value,
        showLineNumbers: document.getElementById('showLineNumbers').checked,
        showWhitespace: document.getElementById('showWhitespace').checked,
        tabSize: document.getElementById('tabSize').value
    };
    
    localStorage.setItem('textEditorSettings', JSON.stringify(settings));
    showNotification('编辑器设置已保存', 'success');
    
    // 关闭模态框
    setTimeout(() => {
        const modal = document.querySelector('.modal.show');
        if (modal) {
            modal.remove();
        }
    }, 1000);
}

// 加载编辑器设置
function loadEditorSettings() {
    try {
        const saved = localStorage.getItem('textEditorSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            
            // 应用设置
            if (document.getElementById('editorFontSize')) {
                document.getElementById('editorFontSize').value = settings.fontSize || '14';
            }
            if (document.getElementById('editorTheme')) {
                document.getElementById('editorTheme').value = settings.theme || 'dark';
            }
            if (document.getElementById('editorFontFamily')) {
                document.getElementById('editorFontFamily').value = settings.fontFamily || 'Consolas';
            }
            if (document.getElementById('showLineNumbers')) {
                document.getElementById('showLineNumbers').checked = settings.showLineNumbers || false;
            }
            if (document.getElementById('showWhitespace')) {
                document.getElementById('showWhitespace').checked = settings.showWhitespace || false;
            }
            if (document.getElementById('tabSize')) {
                document.getElementById('tabSize').value = settings.tabSize || '4';
            }
            
            // 立即应用视觉设置
            updateEditorFontSize(settings.fontSize || '14');
            updateEditorTheme(settings.theme || 'dark');
            updateEditorFontFamily(settings.fontFamily || 'Consolas');
            updateTabSize(settings.tabSize || '4');
        }
    } catch (error) {
        console.error('加载编辑器设置失败:', error);
    }
}

// 恢复默认设置
function resetEditorSettings() {
    const defaults = {
        fontSize: '14',
        theme: 'dark',
        fontFamily: 'Consolas',
        showLineNumbers: false,
        showWhitespace: false,
        tabSize: '4'
    };
    
    if (confirm('确定要恢复默认编辑器设置吗？')) {
        localStorage.setItem('textEditorSettings', JSON.stringify(defaults));
        
        // 更新UI
        if (document.getElementById('editorFontSize')) {
            document.getElementById('editorFontSize').value = defaults.fontSize;
        }
        if (document.getElementById('editorTheme')) {
            document.getElementById('editorTheme').value = defaults.theme;
        }
        if (document.getElementById('editorFontFamily')) {
            document.getElementById('editorFontFamily').value = defaults.fontFamily;
        }
        if (document.getElementById('showLineNumbers')) {
            document.getElementById('showLineNumbers').checked = defaults.showLineNumbers;
        }
        if (document.getElementById('showWhitespace')) {
            document.getElementById('showWhitespace').checked = defaults.showWhitespace;
        }
        if (document.getElementById('tabSize')) {
            document.getElementById('tabSize').value = defaults.tabSize;
        }
        
        // 立即应用
        updateEditorFontSize(defaults.fontSize);
        updateEditorTheme(defaults.theme);
        updateEditorFontFamily(defaults.fontFamily);
        updateTabSize(defaults.tabSize);
        
        showNotification('已恢复默认设置', 'success');
    }
}

// 显示编辑器设置（增强版）
function showEditorSettings() {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-cog"></i> 编辑器设置</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="space-y-4">
                    <div class="form-group">
                        <label class="form-label">字体大小</label>
                        <select id="editorFontSize" class="form-control" onchange="updateEditorFontSize(this.value)">
                            <option value="12">12px</option>
                            <option value="13">13px</option>
                            <option value="14" selected>14px</option>
                            <option value="15">15px</option>
                            <option value="16">16px</option>
                            <option value="17">17px</option>
                            <option value="18">18px</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">编辑器主题</label>
                        <select id="editorTheme" class="form-control" onchange="updateEditorTheme(this.value)">
                            <option value="dark" selected>黑色主题</option>
                            <option value="dark-gray">深灰主题</option>
                            <option value="light">亮色主题</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">字体家族</label>
                        <select id="editorFontFamily" class="form-control" onchange="updateEditorFontFamily(this.value)">
                            <option value="Consolas" selected>Consolas</option>
                            <option value="Monaco">Monaco</option>
                            <option value="Courier New">Courier New</option>
                            <option value="'Fira Code'">Fira Code</option>
                            <option value="'JetBrains Mono'">JetBrains Mono</option>
                            <option value="'Source Code Pro'">Source Code Pro</option>
                        </select>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" id="showLineNumbers" onchange="toggleLineNumbers(this.checked)">
                                显示行号
                            </label>
                        </div>
                        <div class="form-group">
                            <label class="form-label">
                                <input type="checkbox" id="showWhitespace" onchange="toggleWhitespace(this.checked)">
                                显示空格
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Tab键缩进</label>
                        <select id="tabSize" class="form-control" onchange="updateTabSize(this.value)">
                            <option value="2">2个空格</option>
                            <option value="4" selected>4个空格</option>
                            <option value="8">8个空格</option>
                            <option value="tab">制表符</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="resetEditorSettings()">
                    <i class="fas fa-undo"></i> 恢复默认
                </button>
                <button class="btn btn-primary" onclick="saveEditorSettings()">
                    <i class="fas fa-save"></i> 保存设置
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 加载保存的设置
    loadEditorSettings();
}

// 初始化文本编辑器（增强版）
function initTextEditor() {
    const textarea = document.getElementById('textEditor');
    if (!textarea) return;
    
    // 加载保存的设置
    try {
        const saved = localStorage.getItem('textEditorSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            
            // 应用字体大小
            textarea.style.fontSize = `${settings.fontSize || '14'}px`;
            
            // 应用字体家族
            textarea.style.fontFamily = `${settings.fontFamily || 'Consolas'}, 'Consolas', 'Monaco', 'Courier New', monospace`;
            
            // 应用主题
            if (settings.theme === 'dark') {
                textarea.classList.add('bg-black', 'text-gray-200');
                textarea.style.backgroundColor = '#000000';
                textarea.style.color = '#e5e7eb';
            } else if (settings.theme === 'dark-gray') {
                textarea.classList.add('bg-gray-900', 'text-gray-200');
                textarea.style.backgroundColor = '#111827';
                textarea.style.color = '#e5e7eb';
            } else {
                textarea.classList.add('bg-white', 'text-gray-900');
                textarea.style.backgroundColor = '#ffffff';
                textarea.style.color = '#111827';
            }
            
            // 应用Tab大小
            if (settings.tabSize === 'tab') {
                textarea.style.tabSize = '4';
            } else {
                textarea.style.tabSize = settings.tabSize || '4';
            }
        }
    } catch (error) {
        console.error('应用编辑器设置失败:', error);
    }
    
    // 自动调整高度
    textarea.style.height = 'auto';
    const computedHeight = Math.max(400, textarea.scrollHeight);
    textarea.style.height = computedHeight + 'px';
    
    // 监听输入事件
    textarea.addEventListener('input', function() {
        // 更新字符和行数统计
        updateEditorStats();
        
        // 自动调整高度
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        
        // 显示已修改状态
        const status = document.getElementById('editorStatus');
        if (status) {
            status.innerHTML = '<i class="fas fa-pen text-yellow-500"></i> 已修改';
            status.className = 'text-yellow-500';
        }
    });
    
    // 添加键盘快捷键
    textarea.addEventListener('keydown', function(event) {
        // Ctrl + S 保存
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            
            const modal = document.querySelector('.modal.show');
            const saveBtn = modal?.querySelector('button[onclick*="saveTextFile"]');
            if (saveBtn) {
                // 提取filePath参数
                const onclickAttr = saveBtn.getAttribute('onclick');
                const match = onclickAttr.match(/saveTextFile\('([^']+)'\)/);
                if (match && match[1]) {
                    saveTextFile(match[1]);
                }
            }
        }
        
        // Ctrl + F 查找（功能开发中）
        if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
            event.preventDefault();
            showNotification('查找功能开发中', 'info');
        }
        
        // Ctrl + Z 撤销（浏览器默认支持）
        // Ctrl + Y 重做（浏览器默认支持）
        
        // Tab 键缩进
        if (event.key === 'Tab') {
            event.preventDefault();
            const start = this.selectionStart;
            const end = this.selectionEnd;
            
            // 获取Tab大小设置
            let tabSize = '4';
            try {
                const saved = localStorage.getItem('textEditorSettings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    tabSize = settings.tabSize || '4';
                }
            } catch (error) {
                console.error('获取Tab设置失败:', error);
            }
            
            if (tabSize === 'tab') {
                // 插入制表符
                this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + 1;
            } else {
                // 插入空格
                const spaces = ' '.repeat(parseInt(tabSize) || 4);
                this.value = this.value.substring(0, start) + spaces + this.value.substring(end);
                this.selectionStart = this.selectionEnd = start + spaces.length;
            }
        }
    });
    
    // 监听光标移动
    textarea.addEventListener('click', updateEditorStats);
    textarea.addEventListener('keyup', updateEditorStats);
    
    // 监听滚动
    textarea.addEventListener('scroll', function() {
        // 可以在这里实现滚动条同步等功能
    });
    
    // 聚焦到编辑器并选择所有文本
    textarea.focus();
    textarea.select();
}

// 保存文本文件
async function saveTextFile(filePath) {
    const textarea = document.getElementById('textEditor');
    if (!textarea) {
        showNotification('编辑器未找到', 'error');
        return;
    }
    
    const content = textarea.value;
    
    try {
        const response = await fetch('/api/files/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                filePath: filePath,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('文件保存成功', 'success');
            
            // 更新状态为已保存
            const status = document.getElementById('editorStatus');
            if (status) {
                status.innerHTML = '<i class="fas fa-check text-green-500"></i> 已保存';
                status.className = 'text-green-500';
            }
            
            // 3秒后关闭模态框
            setTimeout(() => {
                const modal = document.querySelector('.modal.show');
                if (modal) {
                    modal.remove();
                }
            }, 3000);
        } else {
            showNotification(`保存失败: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('保存文件失败:', error);
        showNotification(`保存失败: ${error.message}`, 'error');
    }
}

// 下载文本文件
function downloadTextFile(filePath, filename) {
    const textarea = document.getElementById('textEditor');
    if (!textarea) {
        showNotification('编辑器未找到', 'error');
        return;
    }
    
    const content = textarea.value;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    showNotification('文件已准备下载', 'info');
}

// 查看文件
async function viewFile(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    // 检查文件扩展名，判断是否为文本文件
    const textExtensions = ['.txt', '.json', '.yml', '.yaml', '.properties', '.ini', '.cfg', '.conf', '.xml', '.html', '.htm', '.css', '.js', '.ts', '.md', '.log'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    if (textExtensions.includes(ext)) {
        // 如果是文本文件，打开编辑器
        await openTextEditor(filename);
    } else {
        // 如果是其他文件，显示查看模态框
        await viewBinaryFile(filename);
    }
}

// 查看二进制文件
async function viewBinaryFile(filename) {
    try {
        const currentPath = window.currentFilePath || '/';
        const filePath = currentPath === '/' ? filename : `${currentPath}/${filename}`;
        
        const response = await fetch(`/api/files?serverPath=${encodeURIComponent(currentServer.path)}&path=${encodeURIComponent(filePath)}`);
        const data = await response.json();
        
        if (data.success && !data.isDirectory) {
            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px; max-height: 80vh;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-eye"></i> 查看文件: ${filename}</h3>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="p-4 border-b border-gray-700">
                            <div class="flex items-center gap-2">
                                <i class="${getFileIcon(filename)}"></i>
                                <span>${filename}</span>
                                <span class="text-xs text-gray-500 ml-auto">二进制文件</span>
                            </div>
                        </div>
                        <div class="p-4">
                            <div class="text-center py-8">
                                <i class="fas fa-file-binary text-4xl text-gray-600 mb-4"></i>
                                <p class="text-gray-400">这是一个二进制文件，无法在浏览器中直接查看</p>
                                <div class="mt-4">
                                    <button onclick="downloadFile('${filename}')" class="btn btn-primary">
                                        <i class="fas fa-download"></i> 下载文件
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        } else {
            showNotification('无法读取文件', 'error');
        }
    } catch (error) {
        console.error('查看文件失败:', error);
        showNotification(`查看文件失败: ${error.message}`, 'error');
    }
}

function downloadFile(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    // 创建下载链接
    const filePath = window.currentFilePath || '/';
    const fullPath = filePath === '/' ? filename : `${filePath}/${filename}`;
    const downloadUrl = `/api/files/download?serverPath=${encodeURIComponent(currentServer.path)}&filePath=${encodeURIComponent(fullPath)}`;
    
    // 在新窗口打开下载链接
    window.open(downloadUrl, '_blank');
    showNotification(`开始下载 ${filename}`, 'info');
}

// 重命名文件（实际实现）
async function renameFile(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    const newName = prompt(`重命名文件 "${filename}" 为：`, filename);
    
    if (!newName || newName === filename) {
        return;
    }
    
    if (!confirm(`确定要将 "${filename}" 重命名为 "${newName}" 吗？`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/files/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                oldName: filename,
                newName: newName,
                currentPath: window.currentFilePath || '/'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('文件重命名成功', 'success');
            
            // 刷新文件列表
            setTimeout(() => {
                if (currentPage === 'files') {
                    loadPage('files');
                }
            }, 1000);
        } else {
            showNotification(`重命名失败: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('重命名文件失败:', error);
        showNotification(`重命名失败: ${error.message}`, 'error');
    }
}

// 删除文件（实际实现）
async function deleteFile(filename) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    // 获取文件类型
    const isDirectory = confirm(`"${filename}" 是一个文件夹吗？\n\n点击"确定"表示是文件夹，点击"取消"表示是文件。`);
    
    const actionText = isDirectory ? '文件夹' : '文件';
    
    if (!confirm(`确定要删除${actionText} "${filename}" 吗？此操作不可恢复！`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/files/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                fileName: filename,
                currentPath: window.currentFilePath || '/',
                isDirectory: isDirectory
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`${actionText}删除成功`, 'success');
            
            // 刷新文件列表
            setTimeout(() => {
                if (currentPage === 'files') {
                    loadPage('files');
                }
            }, 1000);
        } else {
            showNotification(`删除失败: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('删除文件失败:', error);
        showNotification(`删除失败: ${error.message}`, 'error');
    }
}

function selectAllFiles() {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = true;
    });
    document.getElementById('selectAllCheckbox').checked = true;
}

function deselectAllFiles() {
    const checkboxes = document.querySelectorAll('.file-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    document.getElementById('selectAllCheckbox').checked = false;
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.file-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });
}

function deleteSelectedFiles() {
    const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
        .map(cb => cb.dataset.path);
    
    if (selectedFiles.length === 0) {
        showNotification('请先选择要删除的文件', 'error');
        return;
    }
    
    if (!confirm(`确定要删除选中的 ${selectedFiles.length} 个文件吗？此操作不可恢复！`)) {
        return;
    }
    
    showNotification(`批量删除 ${selectedFiles.length} 个文件功能开发中`, 'info');
}

function downloadSelectedFiles() {
    const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
        .map(cb => cb.dataset.path);
    
    if (selectedFiles.length === 0) {
        showNotification('请先选择要下载的文件', 'error');
        return;
    }
    
    showNotification(`批量下载 ${selectedFiles.length} 个文件功能开发中`, 'info');
}

function refreshFileList() {
    if (currentPage === 'files') {
        loadPage('files');
    }
}

// 创建文件夹（实际实现）
function showCreateFolderModal() {
    const folderName = prompt('请输入新文件夹名称：', '新建文件夹');
    
    if (!folderName) {
        return;
    }
    
    // 立即执行创建
    createFolder(folderName);
}

async function createFolder(folderName) {
    if (!currentServer) {
        showNotification('请先选择服务器', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/files/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serverPath: currentServer.path,
                folderName: folderName,
                currentPath: window.currentFilePath || '/'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('文件夹创建成功', 'success');
            
            // 刷新文件列表
            setTimeout(() => {
                if (currentPage === 'files') {
                    loadPage('files');
                }
            }, 1000);
        } else {
            showNotification(`创建失败: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('创建文件夹失败:', error);
        showNotification(`创建失败: ${error.message}`, 'error');
    }
}

// ==================== 工具函数 ====================
function updateDashboardStats() {
    if (!serverStatus) return;
    
    // 更新CPU使用率显示
    const cpuUsage = document.getElementById('cpu-usage');
    if (cpuUsage) {
        cpuUsage.textContent = `${serverStatus.cpu}%`;
        const progressFill = cpuUsage.parentElement?.nextElementSibling?.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${serverStatus.cpu}%`;
        }
    }
    
    // 更新内存使用显示
    const memUsage = document.getElementById('mem-usage');
    if (memUsage && serverStatus.memory) {
        memUsage.textContent = `${serverStatus.memory.used} MB`;
        const progressFill = memUsage.parentElement?.nextElementSibling?.querySelector('.progress-fill');
        if (progressFill && serverStatus.memory.max > 0) {
            const percent = (serverStatus.memory.used / serverStatus.memory.max * 100);
            progressFill.style.width = `${percent}%`;
        }
    }
    
    // 更新TPS显示
    updateTPSDisplay();
}

function updateTPSDisplay() {
    const tpsValue = document.getElementById('tpsValue');
    if (tpsValue && serverStatus) {
        tpsValue.textContent = serverStatus.tps;
        
        // 根据TPS值改变颜色
        if (serverStatus.tps < 10) {
            tpsValue.style.color = '#ef4444'; // 红色
        } else if (serverStatus.tps < 15) {
            tpsValue.style.color = '#f59e0b'; // 黄色
        } else {
            tpsValue.style.color = '#10b981'; // 绿色
        }
    }
}

function refreshServerStatus() {
    if (currentPage === 'dashboard') {
        loadPage('dashboard');
    }
}

function updateStatusBar() {
    if (!serverStatus) return;
    
    // 更新底部状态栏
    const playerCount = document.getElementById('footerPlayerCount');
    if (playerCount) {
        playerCount.textContent = serverStatus.players?.length || 0;
    }
    
    const cpuUsage = document.getElementById('footerCPU');
    if (cpuUsage) {
        cpuUsage.textContent = `${serverStatus.cpu}%`;
    }
    
    const memoryUsage = document.getElementById('footerMemory');
    if (memoryUsage && serverStatus.memory) {
        memoryUsage.textContent = `${serverStatus.memory.used}MB`;
    }
}

function showNotification(message, type = 'info') {
    // 尝试使用HTML中定义的函数
    if (window.showNotification) {
        window.showNotification(message, type);
        return;
    }
    
    // 备用方案
    console.log(`${type}: ${message}`);
    alert(`${type}: ${message}`);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 登录相关函数 ====================

// 获取当前用户名
function getCurrentUsername() {
    // 从页面元素或session获取
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        return usernameElement.textContent;
    }
    return null;
}

// 强制登录函数
async function forceLogin(username, password) {
    const response = await fetch('/api/auth/force-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    const message = document.getElementById('message');
    
    if (data.success) {
        message.className = 'alert alert-success';
        message.innerHTML = `
            <i class="fas fa-check-circle"></i> 登录成功，已强制下线 ${data.kickedUser || '其他用户'}
            <p class="text-sm mt-1">正在跳转...</p>
        `;
        
        // WebSocket认证
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'auth',
                username: username
            }));
        }
        
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
    } else {
        message.className = 'alert alert-error';
        message.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${data.message || '强制登录失败'}`;
    }
}