let keywords = '';
let submitButton;
let toolType = '';
let createPrompt = '';

// 监听来自content-script的采集结果
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'preview_data') {
        console.log('收到预览数据:', request.data);
        // 显示预览面板
        showPreviewPanel(request.data);
        // 启用提交按钮
        if (submitButton) {
            submitButton.disabled = false;
        }
        // 发送响应确认收到数据
        if (sendResponse) {
            sendResponse({status: 'success', message: '预览数据已接收'});
        }
        // 将预览数据转发回content-script以在页面中显示预览面板
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                type: 'show_preview_panel',
                data: request.data
            });
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    // 加载采集层级设置
    chrome.storage.local.get('setting', function (data) {
        if (data.setting && data.setting.level) {
            const currentLevel = data.setting.level;
            const radioToCheck = document.querySelector('input[name="level"][value="' + currentLevel + '"]');
            if (radioToCheck) {
                radioToCheck.checked = true;
            }
        }
        createPrompt = (typeof data.setting.create_prompt !== 'undefined') ? data.setting.create_prompt : '';
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
        createPrompt = (typeof data.setting.create_prompt !== 'undefined') ? data.setting.create_prompt : '';
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
    
    // 向 content-scripts.js 发送消息，包含关键词信息
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { 
            keywords: keywords,
            type: toolType,
            level: selectedLevel,
            showPreview: true
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
    else if(createPrompt == '')
    {
        showPopup("没有配置生成prompt,请点击右上角设置！");
        submitButton.disabled = false;
        return;
    }
    chrome.storage.local.set({ 'pga_keywords': keywords }, function() {
        sendSearchMessage();
    });
});