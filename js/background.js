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