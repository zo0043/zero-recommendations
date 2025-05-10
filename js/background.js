let collectTag = '';

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        console.log(request.type);
        if (request.type === "init_setting")
        {
            getSetting();
            sendResponse({ farewell: "Background runtime onMessage!" });
        }
        else if(request.type == "web_spider_collect")
        {
            getSetting(function (){
                openTabSpiderColletc(request.url)
            });
        }
        else if(request.type == "web_spider_complete")
        {
            chrome.tabs.remove(sender.tab.id);
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {'data':request.data,type:'web_spider_complete'});
            });
        }
        // 转发preview_data消息到提取窗口
        else if(request.type == "preview_data") {
            console.log('Background收到预览数据:', request);
            
            // 如果指定了提取窗口ID，向提取窗口发送消息
            if (request.extractWindowId) {
                // 查找窗口中的所有标签页
                chrome.tabs.query({windowId: request.extractWindowId}, function(tabs) {
                    if (tabs && tabs.length > 0) {
                        // 向提取窗口的标签页发送消息
                        chrome.tabs.sendMessage(tabs[0].id, {
                            type: 'preview_data',
                            data: request.data
                        }, function(resp) {
                            if (chrome.runtime.lastError) {
                                console.error('向提取窗口发送消息失败:', chrome.runtime.lastError.message);
                            } else {
                                console.log('向提取窗口发送消息成功:', resp);
                            }
                        });
                    } else {
                        console.error('找不到提取窗口的标签页');
                    }
                });
            } 
            // 没有指定提取窗口ID，尝试向popup发送消息
            else {
                try {
                    // 查找当前活动的标签页
                    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                        if (tabs && tabs.length > 0) {
                            // 将消息传递给当前标签页的content-script
                            chrome.tabs.sendMessage(tabs[0].id, {
                                type: 'show_preview_panel',
                                data: request.data
                            }, function(resp) {
                                if (chrome.runtime.lastError) {
                                    console.error('向当前标签页发送消息失败:', chrome.runtime.lastError.message);
                                }
                            });
                        }
                    });
                    
                    // 即使找不到活动标签页，也尝试将数据保存到storage
                    chrome.storage.local.set({
                        'last_preview_data': request.data,
                        'last_preview_timestamp': Date.now()
                    });
                } catch (error) {
                    console.error('处理preview_data消息出错:', error);
                }
            }
            
            if (sendResponse) {
                sendResponse({status: 'success', message: '已处理预览数据'});
            }
        }
        // 提取窗口创建后的初始化消息
        else if(request.type == "extract_window_ready") {
            chrome.storage.local.get(['current_extraction', 'active_tab_id'], function(data) {
                if (data.current_extraction && data.active_tab_id) {
                    // 更新提取窗口ID
                    if (sender.tab && sender.tab.windowId) {
                        data.current_extraction.windowId = sender.tab.windowId;
                        chrome.storage.local.set({ 'current_extraction': data.current_extraction });
                    }
                    
                    // 向内容脚本发送提取请求
                    chrome.tabs.sendMessage(data.active_tab_id, {
                        type: data.current_extraction.type,
                        keywords: data.current_extraction.keywords,
                        level: data.current_extraction.level,
                        showPreview: false,
                        extractWindowId: sender.tab.windowId
                    });
                }
            });
            if (sendResponse) {
                sendResponse({status: 'success', message: '提取窗口初始化完成'});
            }
        }
    }
);

function openTabSpiderColletc(url)
{
    chrome.tabs.create({ url: url ,active: false}, (tab) => {
        // 监听标签页加载完成事件
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {

            if (tabId === tab.id && changeInfo.status === "complete") {
                // 从标签页中执行脚本以获取 DOM 内容
                console.log(collectTag);
                // 确保collectTag不为空
                if (!collectTag) {
                    console.error('collectTag未定义或为空');
                    chrome.tabs.remove(tab.id);
                    return;
                }
                chrome.scripting.executeScript(
                    {
                        target: { tabId: tab.id },
                        function: (collectTag) => {
                            try {
                                let collectSetting = JSON.parse(collectTag);
                                const titleElement = document.querySelector(collectSetting.title);
                                const contentElement = document.querySelector(collectSetting.content);
                                chrome.runtime.sendMessage({ 'type': 'web_spider_complete',"data":{"title":titleElement ? titleElement.innerText : '','content':contentElement ? contentElement.innerText : ''} });
                            } catch(e) {
                                console.error('解析collectTag出错:', e);
                                chrome.runtime.sendMessage({ 'type': 'web_spider_complete',"data":{"title":'错误','content':'配置解析失败'} });
                            }
                        },
                        args:[collectTag]
                    },
                    () => {
                        // 关闭标签页
                        chrome.tabs.remove(tab.id);
                    }
                );

                // 移除监听器
                chrome.tabs.onUpdated.removeListener(listener);
            }
        });
    });

}

function getSetting(callback)
{
    // 获取存储的值
    chrome.storage.local.get('setting', function (data) {
        // 确保data.setting存在，避免TypeError
        if (!data || !data.setting) {
            data = { setting: {} };
        }
        collectTag = (typeof data.setting.collect_tag !== 'undefined') ? data.setting.collect_tag : '';
        if(callback) callback();
    });
}