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
                chrome.scripting.executeScript(
                    {
                        target: { tabId: tab.id },
                        function: (collectTag) => {;
                            let collectSetting = JSON.parse(collectTag);
                            const titleElement = document.querySelector(collectSetting.title);
                            const contentElement = document.querySelector(collectSetting.content);
                            chrome.runtime.sendMessage({ 'type': 'web_spider_complete',"data":{"title":titleElement.innerText,'content':contentElement.innerText} });
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
        collectTag = (typeof data.setting.collect_tag !== 'undefined') ? data.setting.collect_tag : '';
        if(callback) callback();
    });
}