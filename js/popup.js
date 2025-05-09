let keywords = '';
let submitButton;
let toolType = '';

// 存储预览数据
let previewData = null;

// 监听来自background.js和content-script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'preview_data') {
        console.log('收到预览数据:', request.data);
        
        // 存储预览数据
        previewData = request.data;
        
        // 隐藏提取状态
        document.getElementById('extraction-status').style.display = 'none';
        
        // 显示结果页面
        displayResults(request.data);
        
        // 启用提交按钮
        if (submitButton) {
            submitButton.disabled = false;
        }
        
        // 发送响应确认收到数据
        if (sendResponse) {
            sendResponse({status: 'success', message: '预览数据已接收'});
        }
    } else if (request.type === 'popup_still_open') {
        // 接收到background.js发送的保持popup打开的消息
        console.log('保持popup打开');
        if (sendResponse) {
            sendResponse({status: 'success'});
        }
    }
});

// 显示结果页面
function displayResults(data) {
    // 切换到结果页面
    document.getElementById('inputPage').style.display = 'none';
    document.getElementById('resultsPage').style.display = 'block';
    
    // 更新层级信息
    document.getElementById('result-level').textContent = data.level || '1';
    
    // 更新关键词列表
    const keywordsList = document.getElementById('result-keywords-list');
    keywordsList.innerHTML = '';
    
    if (data.keywords && data.keywords.length > 0) {
        data.keywords.forEach(keyword => {
            const keywordItem = document.createElement('div');
            keywordItem.className = 'keyword-item';
            keywordItem.textContent = keyword[1]; // 关键词格式为 [level, keyword]
            keywordsList.appendChild(keywordItem);
        });
    } else {
        keywordsList.innerHTML = '<p>暂无采集结果</p>';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // 绑定返回输入页面按钮事件
    document.querySelector('.back-to-input').addEventListener('click', function() {
        document.getElementById('resultsPage').style.display = 'none';
        document.getElementById('inputPage').style.display = 'block';
    });
    
    // 导出CSV按钮点击事件
    document.getElementById('export-csv').addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'export_csv' });
        });
    });
    
    // 导出思维导图按钮点击事件
    document.getElementById('export-mindmap').addEventListener('click', function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'export_mindmap' });
        });
    });
    
    // 加载采集层级设置
    chrome.storage.local.get('setting', function (data) {
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
        // 在这里使用存储的值
        chrome.runtime.sendMessage({"type":"init_setting","setting":data.setting}, function (response) {
            console.log(response.farewell)
        });
    });

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
    // 获取存储的值
    chrome.storage.local.get('setting', function (data) {
        // 确保data.setting存在，避免TypeError
        if (!data || !data.setting) {
            data = { setting: {} };
        }
        
        // 在这里使用存储的值
        chrome.runtime.sendMessage({"type":"init_setting","setting":data.setting}, function (response) {
            console.log(response.farewell)
        });
    });

    chrome.storage.local.get('keywords', function (data) {
        $("#keywords").val(data.keywords);
    });

    chrome.storage.local.get('pga_keywords', function (data) {
        $("#pga_keywords").val(data.pga_keywords);
    });

    // 获取当前标签页的 URL
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        var currentUrl = tabs[0].url;
        console.log(currentUrl);
        // 根据当前 URL 判断展示的页面
        if (currentUrl.includes('chat.openai.com')) {
            document.getElementById('pageSearchKeywords').style.display = 'none';
            document.getElementById('pageGptArticle').style.display = 'block';
            toolType = 'chatgpt_create_article';
        } else {
            document.getElementById('pageSearchKeywords').style.display = 'block';
            document.getElementById('pageGptArticle').style.display = 'none';
            toolType = 'collect_search_keywords';
        }
    });

});
// 获取弹窗元素
const popup = document.getElementById('popup');

// 获取关闭按钮元素
const closeButton = document.getElementById('closePopupBtn');

// 获取错误提示元素
const errorText = document.getElementById('message');

// 显示弹窗并设置错误提示文字
function showPopup(message) {
    errorText.textContent = message;
    popup.style.display = 'block';
}

// 关闭弹窗
function closePopup() {
    popup.style.display = 'none';
}

// 点击关闭按钮关闭弹窗
closeButton.addEventListener('click', closePopup);

/**
 * 发送搜索消息
 */
function sendSearchMessage()
{
    // 获取当前采集层级
    const selectedLevel = document.querySelector('input[name="level"]:checked').value;
    
    // 存储当前提取参数
    chrome.storage.local.set({
        'current_extraction': {
            keywords: keywords,
            level: selectedLevel,
            type: toolType,
            timestamp: Date.now(),
            status: 'pending'
        }
    }, function() {
        // 获取当前标签页，用于后续向其发送提取请求
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs && tabs.length > 0) {
                // 保存标签页ID
                chrome.storage.local.set({ 'active_tab_id': tabs[0].id }, function() {
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
                });
            } else {
                showPopup("无法获取当前页面，请重试。");
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    });
}


$("#submit").click(function (){
    submitButton = this;
    submitButton.disabled = true;
    keywords = $("#keywords").val();
    if(keywords.trim() == '')
    {
        showPopup("输入不可以为空！");
        submitButton.disabled = false;
        return;
    }

    chrome.storage.local.set({ 'keywords': keywords }, function() {
        sendSearchMessage();
    });
});

$("#pga_submit").click(function (){
    submitButton = this;
    submitButton.disabled = true;
    keywords = $("#pga_keywords").val();
    if(keywords.trim() == '')
    {
        showPopup("输入不可以为空！");
        submitButton.disabled = false;
        return;
    }
    // 移除了createPrompt相关检查
    chrome.storage.local.set({ 'pga_keywords': keywords }, function() {
        sendSearchMessage();
    });
});