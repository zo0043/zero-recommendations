// 提取状态和数据
let extractionData = null;
let targetTabId = null;
let extractionTimeout = null;

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    console.log('提取窗口已加载');
    
    // 向background脚本发送窗口已准备好的消息
    chrome.runtime.sendMessage({ type: 'extract_window_ready' }, function(response) {
        console.log('提取窗口初始化响应:', response);
    });
    
    // 获取存储的提取参数和目标标签页ID
    Promise.all([
        new Promise(resolve => {
            chrome.storage.local.get('current_extraction', function(data) {
                if (data && data.current_extraction) {
                    extractionData = data.current_extraction;
                    // 显示源关键词
                    document.getElementById('sourceKeyword').textContent = extractionData.keywords;
                    
                    // 检查是否已经有结果
                    if (extractionData.status === 'completed' && extractionData.result) {
                        showResults(extractionData.result);
                    } else {
                        // 设置提取超时计时器 (30秒)
                        setExtractionTimeout();
                    }
                    
                    resolve();
                } else {
                    showError('没有找到提取参数，请重新打开扩展。');
                    resolve();
                }
            });
        }),
        new Promise(resolve => {
            chrome.storage.local.get('active_tab_id', function(data) {
                if (data && data.active_tab_id) {
                    targetTabId = data.active_tab_id;
                    resolve();
                } else {
                    showError('没有找到目标页面，请重新打开扩展。');
                    resolve();
                }
            });
        })
    ]);
    
    // 绑定按钮事件
    document.getElementById('exportCSV').addEventListener('click', exportCSV);
    document.getElementById('exportMindmap').addEventListener('click', exportMindmap);
    document.getElementById('newExtraction').addEventListener('click', openNewExtraction);
    
    // 定期检查提取状态
    setInterval(checkExtractionStatus, 3000);
});

// 设置提取超时
function setExtractionTimeout() {
    // 清除现有的超时计时器
    if (extractionTimeout) {
        clearTimeout(extractionTimeout);
    }
    
    // 设置新的超时计时器 (30秒)
    extractionTimeout = setTimeout(function() {
        // 检查当前状态
        chrome.storage.local.get('current_extraction', function(data) {
            if (data && data.current_extraction) {
                // 如果状态仍为pending或processing，则视为超时
                if (data.current_extraction.status === 'pending' || 
                    data.current_extraction.status === 'processing') {
                    showError('提取超时，请重试。可能是网络问题或页面未正确加载。');
                }
            }
        });
    }, 30000);
}

// 定期检查提取状态
function checkExtractionStatus() {
    chrome.storage.local.get('current_extraction', function(data) {
        if (data && data.current_extraction) {
            // 如果状态已更新为completed，但UI没有更新
            if (data.current_extraction.status === 'completed' && 
                data.current_extraction.result &&
                !document.getElementById('statusContainer').classList.contains('hidden')) {
                console.log('检测到已完成状态，更新UI');
                showResults(data.current_extraction.result);
            }
        }
    });
}

// 监听来自content-script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('提取窗口收到消息:', request);
    
    if (request.type === 'preview_data') {
        console.log('提取窗口收到预览数据:', request.data);
        
        // 清除超时计时器
        if (extractionTimeout) {
            clearTimeout(extractionTimeout);
            extractionTimeout = null;
        }
        
        // 更新提取状态
        if (extractionData) {
            extractionData.status = 'completed';
            extractionData.result = request.data;
            chrome.storage.local.set({ 'current_extraction': extractionData });
        }
        
        // 显示结果
        showResults(request.data);
        
        // 发送响应确认收到数据
        if (sendResponse) {
            sendResponse({status: 'success', message: '预览数据已接收'});
        }
    }
});

// 显示结果
function showResults(data) {
    // 更新UI
    document.getElementById('statusContainer').classList.add('hidden');
    document.getElementById('resultContainer').classList.remove('hidden');
    
    // 设置层级
    document.getElementById('resultLevel').textContent = data.level || '1';
    
    // 显示关键词列表
    const keywordsList = document.getElementById('keywordsList');
    keywordsList.innerHTML = '';
    
    if (data.keywords && data.keywords.length > 0) {
        data.keywords.forEach(keyword => {
            const keywordItem = document.createElement('div');
            keywordItem.className = 'keyword-item';
            keywordItem.textContent = keyword[1]; // 关键词格式为 [level, keyword]
            keywordsList.appendChild(keywordItem);
        });
    } else {
        keywordsList.innerHTML = '<div class="keyword-item">暂无采集结果</div>';
    }
}

// 显示错误信息
function showError(message) {
    const statusContainer = document.getElementById('statusContainer');
    const spinner = statusContainer.querySelector('.spinner');
    const statusText = document.getElementById('statusText');
    
    if (spinner) spinner.style.display = 'none';
    statusText.style.color = 'red';
    statusText.textContent = '出错了: ' + message;
}

// 导出CSV
function exportCSV() {
    if (targetTabId) {
        chrome.tabs.sendMessage(targetTabId, { type: 'export_csv' });
    } else {
        showError('无法找到目标页面，请重新打开扩展。');
    }
}

// 导出思维导图
function exportMindmap() {
    if (targetTabId) {
        chrome.tabs.sendMessage(targetTabId, { type: 'export_mindmap' });
    } else {
        showError('无法找到目标页面，请重新打开扩展。');
    }
}

// 打开新的提取
function openNewExtraction() {
    // 打开扩展popup
    chrome.action.openPopup();
    
    // 关闭当前窗口
    chrome.windows.getCurrent(function(window) {
        chrome.windows.remove(window.id);
    });
} 