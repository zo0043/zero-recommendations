// 传统弹窗界面 - 优化版本
// 使用状态管理器和反馈管理器优化交互体验

// 全局变量
let cleanupFunctions = [];
let messageListener = null;

// 初始化页面
document.addEventListener('DOMContentLoaded', async function() {
    console.log('传统弹窗界面已加载');
    
    try {
        // 初始化管理器
        await initializeManagers();
        
        // 加载存储的设置
        await loadSettings();
        
        // 获取当前标签页信息
        await getCurrentTabInfo();
        
        // 绑定事件监听器
        bindEventListeners();
        
        // 设置状态订阅
        setupStateSubscriptions();
        
        // 设置消息监听器
        setupMessageListener();
        
        // 设置键盘快捷键
        setupKeyboardShortcuts();
        
        // 检查是否有预览数据
        await checkPreviewData();
        
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
    
    // 设置初始状态
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
        
        // 加载PGA关键词
        const pgaKeywordsData = await stateManager.storageGet('pga_keywords');
        if (pgaKeywordsData.pga_keywords) {
            document.getElementById('pga_keywords').value = pgaKeywordsData.pga_keywords;
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
            }
            
            // 更新状态
            stateManager.updateState({
                targetTabId: targetTabId,
                toolType: toolType
            });
            
            // 根据工具类型显示相应页面
            updatePageVisibility(toolType);
        }
    } catch (error) {
        console.error('获取标签页信息失败:', error);
        feedbackManager.showError('获取页面信息失败');
    }
}

// 更新页面可见性
function updatePageVisibility(toolType) {
    const searchPage = document.getElementById('pageSearchKeywords');
    const gptPage = document.getElementById('pageGptArticle');
    
    if (toolType === 'chatgpt_create_article') {
        searchPage.style.display = 'none';
        gptPage.style.display = 'block';
    } else {
        searchPage.style.display = 'block';
        gptPage.style.display = 'none';
    }
}

// 绑定事件监听器
function bindEventListeners() {
    // 返回输入页面按钮
    const backBtn = document.querySelector('.back-to-input');
    if (backBtn) {
        backBtn.addEventListener('click', handleBackToInput);
    }
    
    // 导出CSV按钮
    const exportCsvBtn = document.getElementById('export-csv');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', handleExportCSV);
    }
    
    // 导出思维导图按钮
    const exportMindmapBtn = document.getElementById('export-mindmap');
    if (exportMindmapBtn) {
        exportMindmapBtn.addEventListener('click', handleExportMindmap);
    }
    
    // 提交按钮
    const submitBtn = document.getElementById('submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleSubmit);
    }
    
    // PGA提交按钮
    const pgaSubmitBtn = document.getElementById('pga_submit');
    if (pgaSubmitBtn) {
        pgaSubmitBtn.addEventListener('click', handlePgaSubmit);
    }
    
    // 采集层级设置
    const levelRadios = document.querySelectorAll('input[name="level"]');
    levelRadios.forEach(radio => {
        radio.addEventListener('change', handleLevelChange);
    });
    
    // 弹窗关闭按钮
    const closePopupBtn = document.getElementById('closePopupBtn');
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', closePopup);
    }
    
    // 添加工具提示
    setupTooltips();
}

// 设置状态订阅
function setupStateSubscriptions() {
    // 订阅UI状态变化
    const unsubscribeUI = stateManager.subscribe('ui', (newUI) => {
        updateUIBasedOnState(newUI);
    });
    
    cleanupFunctions.push(unsubscribeUI);
}

// 设置消息监听器
function setupMessageListener() {
    messageListener = chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        try {
            if (request.type === 'preview_data') {
                handlePreviewData(request, sendResponse);
            } else if (request.type === 'popup_still_open') {
                console.log('保持popup打开');
                if (sendResponse) {
                    sendResponse({ status: 'success' });
                }
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
    
    cleanupFunctions.push(() => {
        if (messageListener) {
            chrome.runtime.onMessage.removeListener(messageListener);
        }
    });
}

// 设置键盘快捷键
function setupKeyboardShortcuts() {
    const shortcuts = {
        'Enter': () => {
            const state = stateManager.getState();
            if (state.ui.currentPage === 'input') {
                if (state.toolType === 'chatgpt_create_article') {
                    handlePgaSubmit();
                } else {
                    handleSubmit();
                }
            }
        },
        'Escape': () => {
            const state = stateManager.getState();
            if (state.ui.currentPage === 'result') {
                handleBackToInput();
            }
        }
    };
    
    const cleanup = feedbackManager.setupKeyboardShortcuts(shortcuts);
    cleanupFunctions.push(cleanup);
}

// 检查是否有预览数据
async function checkPreviewData() {
    try {
        const data = await stateManager.storageGet('preview_data');
        if (data && data.preview_data) {
            displayResults(data.preview_data);
        }
    } catch (error) {
        console.error('检查预览数据失败:', error);
    }
}

// 处理返回输入页面
function handleBackToInput() {
    try {
        document.getElementById('resultsPage').style.display = 'none';
        document.getElementById('inputPage').style.display = 'block';
        
        stateManager.updateState({
            ui: {
                currentPage: 'input',
                isLoading: false,
                error: null,
                progress: 0
            }
        });
        
    } catch (error) {
        console.error('返回输入页面失败:', error);
        feedbackManager.showError('返回失败');
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

// 处理提交
async function handleSubmit() {
    try {
        const keywords = document.getElementById('keywords').value.trim();
        
        if (!keywords) {
            feedbackManager.showError('输入不可以为空！');
            return;
        }
        
        // 显示加载状态
        feedbackManager.showLoading('submit', '提交中...');
        
        // 保存关键词
        await stateManager.storageSet({ 'keywords': keywords });
        stateManager.updateState({ keywords: keywords });
        
        // 发送搜索消息
        await sendSearchMessage();
        
    } catch (error) {
        console.error('提交失败:', error);
        feedbackManager.showError('提交失败: ' + error.message);
        feedbackManager.hideLoading('submit');
    }
}

// 处理PGA提交
async function handlePgaSubmit() {
    try {
        const keywords = document.getElementById('pga_keywords').value.trim();
        
        if (!keywords) {
            feedbackManager.showError('输入不可以为空！');
            return;
        }
        
        // 显示加载状态
        feedbackManager.showLoading('pga_submit', '提交中...');
        
        // 保存关键词
        await stateManager.storageSet({ 'pga_keywords': keywords });
        stateManager.updateState({ keywords: keywords });
        
        // 发送搜索消息
        await sendSearchMessage();
        
    } catch (error) {
        console.error('PGA提交失败:', error);
        feedbackManager.showError('提交失败: ' + error.message);
        feedbackManager.hideLoading('pga_submit');
    }
}

// 处理层级变化
async function handleLevelChange() {
    try {
        const selectedLevel = document.querySelector('input[name="level"]:checked').value;
        const state = stateManager.getState();
        const settings = {
            ...state.settings,
            level: selectedLevel
        };
        
        await stateManager.storageSet({ 'setting': settings });
        stateManager.updateState({ settings: settings });
        
        feedbackManager.showSuccess(`采集层级已设置为 ${selectedLevel} 级`, 2000);
        
    } catch (error) {
        console.error('保存层级设置失败:', error);
        feedbackManager.showError('保存设置失败');
    }
}

// 发送搜索消息
async function sendSearchMessage() {
    try {
        const state = stateManager.getState();
        const selectedLevel = document.querySelector('input[name="level"]:checked').value;
        
        // 存储当前提取参数
        const extractionData = {
            keywords: state.keywords,
            level: selectedLevel,
            type: state.toolType,
            timestamp: Date.now(),
            status: 'pending'
        };
        
        await stateManager.storageSet({
            'current_extraction': extractionData
        });
        
        // 获取当前标签页
        const tabs = await new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });
        
        if (tabs && tabs.length > 0) {
            // 保存标签页ID
            await stateManager.storageSet({ 'active_tab_id': tabs[0].id });
            
            // 创建并打开提取状态窗口
            chrome.windows.create({
                url: chrome.runtime.getURL("extract.html"),
                type: "popup",
                width: 450,
                height: 600,
                left: 100,
                top: 100
            });
            
            // 关闭当前popup
            window.close();
        } else {
            feedbackManager.showError("无法获取当前页面，请重试。");
            feedbackManager.hideLoading('submit');
            feedbackManager.hideLoading('pga_submit');
        }
        
    } catch (error) {
        console.error('发送搜索消息失败:', error);
        feedbackManager.showError('发送搜索消息失败: ' + error.message);
        feedbackManager.hideLoading('submit');
        feedbackManager.hideLoading('pga_submit');
    }
}

// 处理预览数据
async function handlePreviewData(request, sendResponse) {
    try {
        console.log('收到预览数据:', request.data);
        
        // 存储预览数据
        await stateManager.storageSet({ 'preview_data': request.data });
        
        // 隐藏提取状态
        const extractionStatus = document.getElementById('extraction-status');
        if (extractionStatus) {
            extractionStatus.style.display = 'none';
        }
        
        // 显示结果页面
        displayResults(request.data);
        
        // 发送响应确认收到数据
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

// 显示结果
function displayResults(data) {
    try {
        // 切换到结果页面
        document.getElementById('inputPage').style.display = 'none';
        document.getElementById('resultsPage').style.display = 'block';
        
        // 更新层级信息
        document.getElementById('result-level').textContent = data.level || '1';
        
        // 更新关键词列表
        const keywordsList = document.getElementById('result-keywords-list');
        keywordsList.innerHTML = '';
        
        if (data.keywords && data.keywords.length > 0) {
            data.keywords.forEach((keyword, index) => {
                setTimeout(() => {
                    const keywordItem = createKeywordItem(keyword[1], keyword[0]);
                    keywordsList.appendChild(keywordItem);
                }, index * 50);
            });
        } else {
            keywordsList.innerHTML = '<p>暂无采集结果</p>';
        }
        
        // 更新状态
        stateManager.updateState({
            ui: {
                currentPage: 'result',
                isLoading: false,
                error: null,
                progress: 100
            }
        });
        
    } catch (error) {
        console.error('显示结果失败:', error);
        feedbackManager.showError('显示结果失败');
    }
}

// 创建关键词项
function createKeywordItem(text, level) {
    const keywordItem = document.createElement('div');
    keywordItem.className = 'keyword-item fade-in';
    
    if (level) {
        const levelIndicator = document.createElement('span');
        levelIndicator.className = `keyword-level level-${level}`;
        levelIndicator.textContent = level;
        keywordItem.appendChild(levelIndicator);
    }
    
    const keywordContent = document.createElement('span');
    keywordContent.className = 'keyword-content';
    keywordContent.textContent = text;
    keywordItem.appendChild(keywordContent);
    
    return keywordItem;
}

// 根据状态更新UI
function updateUIBasedOnState(ui) {
    // 更新按钮状态
    const submitBtn = document.getElementById('submit');
    const pgaSubmitBtn = document.getElementById('pga_submit');
    
    if (ui.isLoading) {
        if (submitBtn) submitBtn.disabled = true;
        if (pgaSubmitBtn) pgaSubmitBtn.disabled = true;
    } else {
        if (submitBtn) submitBtn.disabled = false;
        if (pgaSubmitBtn) pgaSubmitBtn.disabled = false;
    }
}

// 设置工具提示
function setupTooltips() {
    const tooltips = [
        { id: 'export-csv', text: '下载为CSV电子表格格式' },
        { id: 'export-mindmap', text: '下载为Markdown思维导图格式' },
        { id: 'submit', text: '开始提取关键词' },
        { id: 'pga_submit', text: '开始ChatGPT文章生成' }
    ];
    
    tooltips.forEach(({ id, text }) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('mouseenter', (e) => {
                feedbackManager.showTooltip(e.target, text, 'top');
            });
        }
    });
}

// 关闭弹窗
function closePopup() {
    document.getElementById('popup').style.display = 'none';
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
    
    // 清理反馈管理器
    if (window.feedbackManager) {
        window.feedbackManager.destroy();
    }
});