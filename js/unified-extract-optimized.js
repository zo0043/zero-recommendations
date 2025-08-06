// 统一提取界面 - 优化版本
// 使用状态管理器和反馈管理器优化交互体验

// 全局变量
let extractionTimeout = null;
let statusCheckInterval = null;
let cleanupFunctions = [];

// 页面状态枚举
const PAGES = {
    INPUT: 'inputPage',
    STATUS: 'statusPage',
    RESULT: 'resultPage'
};

// 初始化页面
document.addEventListener('DOMContentLoaded', async function() {
    console.log('统一提取界面已加载');
    
    try {
        // 初始化管理器
        await initializeManagers();
        
        // 加载存储的设置
        await loadSettings();
        
        // 获取当前标签页信息
        await getCurrentTabInfo();
        
        // 绑定按钮事件
        bindButtonEvents();
        
        // 设置状态订阅
        setupStateSubscriptions();
        
        // 检查是否有未完成的提取任务
        await checkPendingExtraction();
        
        // 设置定期检查提取状态
        setupStatusChecking();
        
        // 设置键盘快捷键
        setupKeyboardShortcuts();
        
        // 显示初始化完成消息
        feedbackManager.showSuccess('界面已准备就绪', 2000);
        
    } catch (error) {
        console.error('初始化失败:', error);
        feedbackManager.showError('初始化失败: ' + error.message);
    }
});

// 初始化管理器
async function initializeManagers() {
    // 加载持久化状态
    await stateManager.loadPersistedState();
    
    // 设置状态管理器
    stateManager.updateState({
        ui: {
            currentPage: 'input',
            isLoading: false,
            error: null,
            progress: 0
        }
    });
}

// 加载存储的设置
async function loadSettings() {
    try {
        const data = await stateManager.storageGet('setting');
        const settings = data.setting || {};
        
        // 更新状态管理器
        stateManager.updateState({
            settings: settings
        });
        
        // 设置采集层级
        if (settings.level) {
            const radioToCheck = document.querySelector(`input[name="level"][value="${settings.level}"]`);
            if (radioToCheck) {
                radioToCheck.checked = true;
            }
        }
        
        // 初始化扩展设置
        chrome.runtime.sendMessage({
            "type": "init_setting",
            "setting": settings
        }, function(response) {
            if (response) {
                console.log(response.farewell);
            }
        });
        
        // 加载上次使用的关键词
        const keywordsData = await stateManager.storageGet('keywords');
        if (keywordsData.keywords) {
            document.getElementById('keywords').value = keywordsData.keywords;
            stateManager.updateState({
                keywords: keywordsData.keywords
            });
        }
        
    } catch (error) {
        console.error('加载设置失败:', error);
        feedbackManager.showError('加载设置失败');
    }
}

// 获取当前标签页信息
async function getCurrentTabInfo() {
    try {
        const tabs = await new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });
        
        if (tabs && tabs.length > 0) {
            const targetTabId = tabs[0].id;
            const currentUrl = tabs[0].url;
            
            // 根据当前 URL 判断工具类型
            let toolType = 'collect_search_keywords';
            if (currentUrl.includes('chat.openai.com')) {
                toolType = 'chatgpt_create_article';
                // 修改提示文本适应ChatGPT模式
                document.getElementById('keywords').placeholder = "请输入文章主题关键词或采集地址，多个请换行";
            }
            
            // 更新状态
            stateManager.updateState({
                targetTabId: targetTabId,
                toolType: toolType
            });
        }
    } catch (error) {
        console.error('获取标签页信息失败:', error);
        feedbackManager.showError('获取页面信息失败');
    }
}

// 绑定按钮事件
function bindButtonEvents() {
    // 开始提取按钮
    const startBtn = document.getElementById('startExtractionBtn');
    startBtn.addEventListener('click', handleStartExtraction);
    
    // 取消提取按钮
    const cancelBtn = document.getElementById('cancelExtractionBtn');
    cancelBtn.addEventListener('click', handleCancelExtraction);
    
    // 新的提取按钮
    const newBtn = document.getElementById('newExtraction');
    newBtn.addEventListener('click', handleNewExtraction);
    
    // 导出CSV按钮
    const exportCsvBtn = document.getElementById('exportCSV');
    exportCsvBtn.addEventListener('click', handleExportCSV);
    
    // 导出思维导图按钮
    const exportMindmapBtn = document.getElementById('exportMindmap');
    exportMindmapBtn.addEventListener('click', handleExportMindmap);
    
    // 弹窗关闭按钮
    const closePopupBtn = document.getElementById('closePopupBtn');
    closePopupBtn.addEventListener('click', closePopup);
    
    // 保存采集层级设置
    const levelRadios = document.querySelectorAll('input[name="level"]');
    levelRadios.forEach(radio => {
        radio.addEventListener('change', handleLevelChange);
    });
    
    // 添加工具提示
    setupTooltips();
}

// 设置状态订阅
function setupStateSubscriptions() {
    // 订阅UI状态变化
    const unsubscribeUI = stateManager.subscribe('ui', (newUI) => {
        updateUIBasedOnState(newUI);
    });
    
    // 订阅当前提取状态变化
    const unsubscribeExtraction = stateManager.subscribe('currentExtraction', (newExtraction) => {
        updateExtractionBasedOnState(newExtraction);
    });
    
    // 保存清理函数
    cleanupFunctions.push(unsubscribeUI, unsubscribeExtraction);
}

// 处理开始提取
async function handleStartExtraction() {
    try {
        const keywords = document.getElementById('keywords').value.trim();
        const selectedLevel = document.querySelector('input[name="level"]:checked').value;
        
        // 验证输入
        if (!keywords) {
            feedbackManager.showError('请输入关键词');
            return;
        }
        
        // 显示加载状态
        feedbackManager.showLoading('startExtractionBtn', '开始提取...');
        
        // 更新状态
        stateManager.updateState({
            keywords: keywords,
            currentExtraction: {
                keywords: keywords,
                level: selectedLevel,
                type: stateManager.getState().toolType,
                timestamp: Date.now(),
                status: 'pending'
            },
            ui: {
                currentPage: 'status',
                isLoading: true,
                error: null,
                progress: 0
            }
        });
        
        // 保存设置
        await saveSettings(selectedLevel);
        
        // 保存提取参数
        await saveExtractionData();
        
        // 设置提取超时
        setExtractionTimeout();
        
        // 发送提取请求
        await sendExtractionRequest();
        
    } catch (error) {
        console.error('开始提取失败:', error);
        feedbackManager.showError('开始提取失败: ' + error.message);
        resetToInputPage();
    }
}

// 处理取消提取
function handleCancelExtraction() {
    feedbackManager.showConfirm('确定要取消提取吗？', async () => {
        await cancelExtraction();
    });
}

// 处理新的提取
async function handleNewExtraction() {
    try {
        // 重置状态
        stateManager.reset();
        
        // 显示输入页面
        showPage(PAGES.INPUT);
        
        // 清除提取数据
        await stateManager.storageRemove('current_extraction');
        
        feedbackManager.showSuccess('已重置，可以开始新的提取');
        
    } catch (error) {
        console.error('重置失败:', error);
        feedbackManager.showError('重置失败');
    }
}

// 处理导出CSV
async function handleExportCSV() {
    try {
        const state = stateManager.getState();
        if (state.targetTabId) {
            feedbackManager.showInfo('正在导出CSV文件...');
            chrome.tabs.sendMessage(state.targetTabId, { type: 'export_csv' });
            feedbackManager.showSuccess('CSV导出请求已发送');
        } else {
            feedbackManager.showError('无法找到目标页面');
        }
    } catch (error) {
        console.error('导出CSV失败:', error);
        feedbackManager.showError('导出CSV失败');
    }
}

// 处理导出思维导图
async function handleExportMindmap() {
    try {
        const state = stateManager.getState();
        if (state.targetTabId) {
            feedbackManager.showInfo('正在导出思维导图...');
            chrome.tabs.sendMessage(state.targetTabId, { type: 'export_mindmap' });
            feedbackManager.showSuccess('思维导图导出请求已发送');
        } else {
            feedbackManager.showError('无法找到目标页面');
        }
    } catch (error) {
        console.error('导出思维导图失败:', error);
        feedbackManager.showError('导出思维导图失败');
    }
}

// 处理层级变化
async function handleLevelChange() {
    try {
        const selectedLevel = document.querySelector('input[name="level"]:checked').value;
        await saveSettings(selectedLevel);
        feedbackManager.showSuccess(`采集层级已设置为 ${selectedLevel} 级`, 2000);
    } catch (error) {
        console.error('保存层级设置失败:', error);
        feedbackManager.showError('保存设置失败');
    }
}

// 保存设置
async function saveSettings(level) {
    try {
        const state = stateManager.getState();
        const settings = {
            ...state.settings,
            level: level
        };
        
        await stateManager.storageSet({ 'setting': settings });
        stateManager.updateState({ settings: settings });
        
    } catch (error) {
        console.error('保存设置失败:', error);
        throw error;
    }
}

// 保存提取数据
async function saveExtractionData() {
    try {
        const state = stateManager.getState();
        const data = {
            'current_extraction': state.currentExtraction,
            'active_tab_id': state.targetTabId
        };
        
        await stateManager.storageSet(data);
        
    } catch (error) {
        console.error('保存提取数据失败:', error);
        throw error;
    }
}

// 发送提取请求
async function sendExtractionRequest() {
    try {
        const state = stateManager.getState();
        const extraction = state.currentExtraction;
        
        if (!state.targetTabId) {
            throw new Error('无法找到目标标签页');
        }
        
        chrome.tabs.sendMessage(state.targetTabId, {
            type: extraction.type,
            keywords: extraction.keywords,
            level: extraction.level,
            showPreview: false
        }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('发送提取请求时出错:', chrome.runtime.lastError);
                feedbackManager.showError('发送提取请求失败: ' + chrome.runtime.lastError.message);
            } else if (response) {
                console.log('提取请求发送成功，响应:', response);
            }
        });
        
    } catch (error) {
        console.error('发送提取请求失败:', error);
        throw error;
    }
}

// 设置提取超时
function setExtractionTimeout() {
    // 清除现有的超时计时器
    if (extractionTimeout) {
        clearTimeout(extractionTimeout);
    }
    
    // 设置新的超时计时器 (30秒)
    extractionTimeout = setTimeout(async () => {
        try {
            const data = await stateManager.storageGet('current_extraction');
            if (data && data.current_extraction) {
                const extraction = data.current_extraction;
                if (extraction.status === 'pending' || extraction.status === 'processing') {
                    feedbackManager.showError('提取超时，请重试。可能是网络问题或页面未正确加载。');
                    await cancelExtraction();
                }
            }
        } catch (error) {
            console.error('检查超时状态失败:', error);
        }
    }, 30000);
}

// 设置状态检查
function setupStatusChecking() {
    statusCheckInterval = setInterval(async () => {
        try {
            const data = await stateManager.storageGet('current_extraction');
            if (data && data.current_extraction) {
                const extraction = data.current_extraction;
                if (extraction.status === 'completed' && extraction.result) {
                    const state = stateManager.getState();
                    if (state.ui.currentPage === 'status') {
                        console.log('检测到已完成状态，更新UI');
                        await showResults(extraction.result);
                    }
                }
            }
        } catch (error) {
            console.error('检查提取状态失败:', error);
        }
    }, 3000);
    
    cleanupFunctions.push(() => {
        if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
        }
    });
}

// 检查是否有未完成的提取任务
async function checkPendingExtraction() {
    try {
        const data = await stateManager.storageGet('current_extraction');
        if (data && data.current_extraction) {
            const extraction = data.current_extraction;
            
            if (extraction.status === 'pending' || extraction.status === 'processing') {
                // 显示源关键词
                document.getElementById('sourceKeyword').textContent = extraction.keywords;
                
                // 显示状态页面
                showPage(PAGES.STATUS);
                
                // 设置提取超时计时器
                setExtractionTimeout();
                
            } else if (extraction.status === 'completed' && extraction.result) {
                // 显示源关键词
                document.getElementById('sourceKeyword').textContent = extraction.keywords;
                
                // 显示结果
                await showResults(extraction.result);
            }
        }
    } catch (error) {
        console.error('检查待处理提取失败:', error);
    }
}

// 取消提取
async function cancelExtraction() {
    // 清除超时计时器
    if (extractionTimeout) {
        clearTimeout(extractionTimeout);
        extractionTimeout = null;
    }
    
    // 重置状态
    await resetToInputPage();
}

// 重置到输入页面
async function resetToInputPage() {
    try {
        // 更新状态
        stateManager.updateState({
            ui: {
                currentPage: 'input',
                isLoading: false,
                error: null,
                progress: 0
            }
        });
        
        // 隐藏加载状态
        feedbackManager.hideLoading('startExtractionBtn');
        
        // 显示输入页面
        showPage(PAGES.INPUT);
        
        // 清除提取数据
        await stateManager.storageRemove('current_extraction');
        
    } catch (error) {
        console.error('重置失败:', error);
        feedbackManager.showError('重置失败');
    }
}

// 显示结果
async function showResults(data) {
    try {
        // 更新状态
        stateManager.updateState({
            currentExtraction: {
                ...stateManager.getState().currentExtraction,
                status: 'completed',
                result: data
            },
            ui: {
                currentPage: 'result',
                isLoading: false,
                error: null,
                progress: 100
            }
        });
        
        // 显示结果页面
        showPage(PAGES.RESULT);
        
        // 设置层级
        document.getElementById('resultLevel').textContent = data.level || '1';
        
        // 显示关键词列表
        await displayKeywordsList(data.keywords);
        
        // 清除超时计时器
        if (extractionTimeout) {
            clearTimeout(extractionTimeout);
            extractionTimeout = null;
        }
        
        feedbackManager.showSuccess('提取完成！');
        
    } catch (error) {
        console.error('显示结果失败:', error);
        feedbackManager.showError('显示结果失败');
    }
}

// 显示关键词列表
function displayKeywordsList(keywords) {
    return new Promise((resolve) => {
        const keywordsList = document.getElementById('keywordsList');
        keywordsList.innerHTML = '';
        
        if (keywords && keywords.length > 0) {
            keywords.forEach((keyword, index) => {
                setTimeout(() => {
                    const level = keyword[0]; // 级别
                    const text = keyword[1];  // 关键词文本
                    
                    const keywordItem = createKeywordItem(level, text);
                    keywordsList.appendChild(keywordItem);
                    
                    if (index === keywords.length - 1) {
                        resolve();
                    }
                }, index * 50); // 动画效果
            });
        } else {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'keyword-item';
            emptyItem.innerHTML = '<span class="keyword-content">暂无采集结果</span>';
            keywordsList.appendChild(emptyItem);
            resolve();
        }
    });
}

// 创建关键词项
function createKeywordItem(level, text) {
    const keywordItem = document.createElement('div');
    keywordItem.className = 'keyword-item fade-in';
    
    // 创建级别指示器
    const levelIndicator = document.createElement('span');
    levelIndicator.className = `keyword-level level-${level}`;
    levelIndicator.textContent = level;
    
    // 创建关键词内容
    const keywordContent = document.createElement('span');
    keywordContent.className = 'keyword-content';
    keywordContent.textContent = text;
    
    // 添加到项目中
    keywordItem.appendChild(levelIndicator);
    keywordItem.appendChild(keywordContent);
    
    return keywordItem;
}

// 显示指定页面
function showPage(pageId) {
    // 隐藏所有页面
    Object.values(PAGES).forEach(page => {
        const element = document.getElementById(page);
        if (element) {
            element.classList.remove('active');
        }
    });
    
    // 显示指定页面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

// 根据状态更新UI
function updateUIBasedOnState(ui) {
    // 更新页面显示
    if (ui.currentPage) {
        showPage(ui.currentPage);
    }
    
    // 更新加载状态
    if (ui.isLoading) {
        document.getElementById('startExtractionBtn').disabled = true;
    } else {
        document.getElementById('startExtractionBtn').disabled = false;
    }
    
    // 更新进度
    if (ui.progress !== undefined) {
        // 可以在这里添加进度条更新逻辑
    }
}

// 根据提取状态更新UI
function updateExtractionBasedOnState(extraction) {
    if (extraction && extraction.keywords) {
        document.getElementById('sourceKeyword').textContent = extraction.keywords;
    }
}

// 设置工具提示
function setupTooltips() {
    const buttons = [
        { id: 'exportCSV', text: '下载为CSV电子表格格式' },
        { id: 'exportMindmap', text: '下载为Markdown思维导图格式' },
        { id: 'newExtraction', text: '开始新的提取' }
    ];
    
    buttons.forEach(({ id, text }) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('mouseenter', (e) => {
                feedbackManager.showTooltip(e.target, text, 'top');
            });
        }
    });
}

// 设置键盘快捷键
function setupKeyboardShortcuts() {
    const shortcuts = {
        'Enter': () => {
            if (stateManager.getState().ui.currentPage === 'input') {
                handleStartExtraction();
            }
        },
        'Escape': () => {
            if (stateManager.getState().ui.currentPage === 'status') {
                handleCancelExtraction();
            }
        }
    };
    
    const cleanup = feedbackManager.setupKeyboardShortcuts(shortcuts);
    cleanupFunctions.push(cleanup);
}

// 关闭弹窗
function closePopup() {
    document.getElementById('popup').style.display = 'none';
}

// 监听来自content-script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('统一提取界面收到消息:', request);
    
    try {
        if (request.type === 'preview_data') {
            handlePreviewData(request, sendResponse);
        }
    } catch (error) {
        console.error('处理消息时出错:', error);
        if (sendResponse) {
            sendResponse({ status: 'error', message: '处理消息时出错: ' + error.message });
        }
    }
    
    // 确保返回true以支持异步响应
    return true;
});

// 处理预览数据
async function handlePreviewData(request, sendResponse) {
    try {
        console.log('收到预览数据:', JSON.stringify(request.data));
        
        // 检查数据结构
        if (!request.data || typeof request.data !== 'object') {
            console.error('收到的预览数据结构不正确:', request.data);
            if (sendResponse) {
                sendResponse({ status: 'error', message: '数据结构不正确' });
            }
            return;
        }
        
        // 清除超时计时器
        if (extractionTimeout) {
            clearTimeout(extractionTimeout);
            extractionTimeout = null;
        }
        
        // 更新提取状态
        const state = stateManager.getState();
        if (state.currentExtraction) {
            const updatedExtraction = {
                ...state.currentExtraction,
                status: 'completed',
                result: request.data
            };
            
            await stateManager.storageSet({ 'current_extraction': updatedExtraction });
            stateManager.updateState({ currentExtraction: updatedExtraction });
        }
        
        // 显示结果
        await showResults(request.data);
        
        // 发送响应
        if (sendResponse) {
            sendResponse({ status: 'success', message: '预览数据已接收' });
        }
        
    } catch (error) {
        console.error('处理预览数据失败:', error);
        if (sendResponse) {
            sendResponse({ status: 'error', message: '处理预览数据失败: ' + error.message });
        }
    }
}

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    cleanupFunctions.forEach(cleanup => {
        try {
            if (typeof cleanup === 'function') {
                cleanup();
            }
        } catch (error) {
            console.error('清理资源失败:', error);
        }
    });
    
    if (extractionTimeout) {
        clearTimeout(extractionTimeout);
    }
    
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    
    // 清理反馈管理器
    if (window.feedbackManager) {
        window.feedbackManager.destroy();
    }
});