// 全局变量
let extractionTimeout = null;
let targetTabId = null;
let extractionData = null;
let submitButton = null;
let toolType = 'collect_search_keywords';
let keywords = '';

// 页面状态变量
const PAGES = {
    INPUT: 'inputPage',
    STATUS: 'statusPage',
    RESULT: 'resultPage'
};

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    console.log('统一提取界面已加载');
    
    // 加载存储的设置
    loadSettings();
    
    // 获取当前标签页信息
    getCurrentTabInfo();
    
    // 绑定按钮事件
    bindButtonEvents();
    
    // 检查是否有未完成的提取任务
    checkPendingExtraction();
    
    // 设置定期检查提取状态
    setInterval(checkExtractionStatus, 3000);
});

// 加载存储的设置
function loadSettings() {
    // 加载采集层级设置
    chrome.storage.local.get('setting', function(data) {
        // 确保data.setting存在，避免TypeError
        if (!data || !data.setting) {
            data = { setting: {} };
        }
        
        if (data.setting && data.setting.level) {
            const currentLevel = data.setting.level;
            const radioToCheck = document.querySelector('input[name="level"][value="' + currentLevel + '"]');
            if (radioToCheck) {
                radioToCheck.checked = true;
            }
        }
        
        // 初始化扩展设置
        chrome.runtime.sendMessage({"type":"init_setting","setting":data.setting}, function(response) {
            if (response) {
                console.log(response.farewell);
            }
        });
    });
    
    // 加载上次使用的关键词
    chrome.storage.local.get('keywords', function(data) {
        if (data && data.keywords) {
            document.getElementById('keywords').value = data.keywords;
        }
    });
}

// 获取当前标签页信息
function getCurrentTabInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs && tabs.length > 0) {
            targetTabId = tabs[0].id;
            var currentUrl = tabs[0].url;
            
            // 根据当前 URL 判断工具类型
            if (currentUrl.includes('chat.openai.com')) {
                toolType = 'chatgpt_create_article';
                // 修改提示文本适应ChatGPT模式
                document.getElementById('keywords').placeholder = "请输入文章主题关键词或采集地址，多个请换行";
            } else {
                toolType = 'collect_search_keywords';
            }
        }
    });
}

// 绑定按钮事件
function bindButtonEvents() {
    // 开始提取按钮
    document.getElementById('startExtractionBtn').addEventListener('click', startExtraction);
    
    // 取消提取按钮
    document.getElementById('cancelExtractionBtn').addEventListener('click', cancelExtraction);
    
    // 新的提取按钮
    document.getElementById('newExtraction').addEventListener('click', resetToInputPage);
    
    // 导出CSV按钮
    document.getElementById('exportCSV').addEventListener('click', exportCSV);
    
    // 导出思维导图按钮
    document.getElementById('exportMindmap').addEventListener('click', exportMindmap);
    
    // 弹窗关闭按钮
    document.getElementById('closePopupBtn').addEventListener('click', closePopup);
    
    // 保存采集层级设置
    const levelRadios = document.querySelectorAll('input[name="level"]');
    levelRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const selectedLevel = document.querySelector('input[name="level"]:checked').value;
            chrome.storage.local.get('setting', function(result) {
                let settings = result.setting || {};
                settings.level = selectedLevel;
                chrome.storage.local.set({ 'setting': settings }, function() {
                    console.log('采集层级已保存:', selectedLevel);
                });
            });
        });
    });
}

// 检查是否有未完成的提取任务
function checkPendingExtraction() {
    chrome.storage.local.get('current_extraction', function(data) {
        if (data && data.current_extraction) {
            extractionData = data.current_extraction;
            
            // 如果有正在进行中的提取
            if (extractionData.status === 'pending' || extractionData.status === 'processing') {
                // 显示源关键词
                document.getElementById('sourceKeyword').textContent = extractionData.keywords;
                keywords = extractionData.keywords;
                
                // 显示状态页面
                showPage(PAGES.STATUS);
                
                // 设置提取超时计时器 (30秒)
                setExtractionTimeout();
            } 
            // 如果提取已完成
            else if (extractionData.status === 'completed' && extractionData.result) {
                // 显示源关键词
                document.getElementById('sourceKeyword').textContent = extractionData.keywords;
                keywords = extractionData.keywords;
                
                // 显示结果
                showResults(extractionData.result);
            }
        }
    });
}

// 开始提取
function startExtraction() {
    // 获取输入的关键词
    keywords = document.getElementById('keywords').value.trim();
    
    // 验证输入
    if (keywords === '') {
        showPopup("输入不可以为空！");
        return;
    }
    
    // 禁用按钮防止重复点击
    document.getElementById('startExtractionBtn').disabled = true;
    
    // 保存关键词
    chrome.storage.local.set({ 'keywords': keywords }, function() {
        console.log('关键词已保存');
    });
    
    // 获取采集层级
    const selectedLevel = document.querySelector('input[name="level"]:checked').value;
    
    // 保存采集层级设置
    chrome.storage.local.get('setting', function(result) {
        let settings = result.setting || {};
        settings.level = selectedLevel;
        chrome.storage.local.set({ 'setting': settings }, function() {
            console.log('采集层级已保存:', selectedLevel);
        });
    });
    
    // 存储当前提取参数
    extractionData = {
        keywords: keywords,
        level: selectedLevel,
        type: toolType,
        timestamp: Date.now(),
        status: 'pending'
    };
    
    chrome.storage.local.set({
        'current_extraction': extractionData,
        'active_tab_id': targetTabId
    }, function() {
        console.log('提取参数已保存');
        
        // 显示状态页面
        showPage(PAGES.STATUS);
        
        // 设置提取超时计时器
        setExtractionTimeout();
        
        // 向content-script发送提取请求
        sendExtractionRequest();
    });
}

// 发送提取请求到content-script
function sendExtractionRequest() {
    chrome.tabs.sendMessage(targetTabId, {
        type: extractionData.type,
        keywords: extractionData.keywords,
        level: extractionData.level,
        showPreview: false
    }, function(response) {
        if (chrome.runtime.lastError) {
            console.error('发送提取请求时出错:', chrome.runtime.lastError);
            showError('无法发送提取请求: ' + chrome.runtime.lastError.message);
        } else if (response) {
            console.log('提取请求发送成功，响应:', response);
        }
    });
}

// 取消提取
function cancelExtraction() {
    // 清除超时计时器
    if (extractionTimeout) {
        clearTimeout(extractionTimeout);
        extractionTimeout = null;
    }
    
    // 重置状态
    resetToInputPage();
}

// 重置到输入页面
function resetToInputPage() {
    // 重置按钮状态
    document.getElementById('startExtractionBtn').disabled = false;
    
    // 显示输入页面
    showPage(PAGES.INPUT);
    
    // 清除提取数据
    chrome.storage.local.remove('current_extraction', function() {
        console.log('提取数据已清除');
    });
}

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
                document.getElementById('statusPage').style.display !== 'none') {
                console.log('检测到已完成状态，更新UI');
                extractionData = data.current_extraction;
                showResults(data.current_extraction.result);
            }
        }
    });
}

// 监听来自content-script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('统一提取界面收到消息:', request);
    
    try {
        if (request.type === 'preview_data') {
            console.log('收到预览数据:', JSON.stringify(request.data));
            
            // 检查数据结构是否符合预期
            if (!request.data || typeof request.data !== 'object') {
                console.error('收到的预览数据结构不正确:', request.data);
                if (sendResponse) {
                    sendResponse({status: 'error', message: '数据结构不正确'});
                }
                return true;
            }
            
            // 清除超时计时器
            if (extractionTimeout) {
                clearTimeout(extractionTimeout);
                extractionTimeout = null;
            }
            
            // 更新提取状态
            if (extractionData) {
                extractionData.status = 'completed';
                extractionData.result = request.data;
                chrome.storage.local.set({ 'current_extraction': extractionData }, function() {
                    console.log('预览数据已保存到 current_extraction');
                });
            }
            
            // 显示结果
            showResults(request.data);
            
            // 发送响应确认收到数据
            if (sendResponse) {
                sendResponse({status: 'success', message: '预览数据已接收'});
            }
        }
    } catch (error) {
        console.error('处理消息时出错:', error);
        if (sendResponse) {
            sendResponse({status: 'error', message: '处理消息时出错: ' + error.message});
        }
    }
    
    // 确保返回true以支持异步响应
    return true;
});

// 显示结果
function showResults(data) {
    // 显示结果页面
    showPage(PAGES.RESULT);
    
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
    // 如果处于状态页面，更新状态文本
    if (document.getElementById('statusPage').style.display !== 'none') {
        const statusContainer = document.getElementById('statusContainer');
        const spinner = statusContainer.querySelector('.spinner');
        const statusText = document.getElementById('statusText');
        
        statusContainer.classList.add('error-state');
        if (spinner) spinner.style.display = 'none';
        statusText.textContent = '出错了: ' + message;
    } else {
        // 否则显示弹窗
        showPopup(message);
    }
}

// 导出CSV
function exportCSV() {
    if (targetTabId) {
        chrome.tabs.sendMessage(targetTabId, { type: 'export_csv' });
    } else {
        showError('无法找到目标页面，请重试。');
    }
}

// 导出思维导图
function exportMindmap() {
    if (targetTabId) {
        chrome.tabs.sendMessage(targetTabId, { type: 'export_mindmap' });
    } else {
        showError('无法找到目标页面，请重试。');
    }
}

// 显示指定页面
function showPage(pageId) {
    // 隐藏所有页面
    document.getElementById(PAGES.INPUT).style.display = 'none';
    document.getElementById(PAGES.STATUS).style.display = 'none';
    document.getElementById(PAGES.RESULT).style.display = 'none';
    
    // 显示指定页面
    document.getElementById(pageId).style.display = 'block';
}

// 显示弹窗
function showPopup(message) {
    document.getElementById('message').textContent = message;
    document.getElementById('popup').style.display = 'block';
}

// 关闭弹窗
function closePopup() {
    document.getElementById('popup').style.display = 'none';
} 