// options.js
document.addEventListener('DOMContentLoaded', function() {
    var collectTag = document.getElementById('collectTag');
    var saveButton = document.getElementById('saveButton');


    // 获取保存的密钥值并设置输入框的默认值
    chrome.storage.local.get('setting', function(result) {
        let setting = result.setting;
        if (setting) {
            collectTag.value = setting.collect_tag;

            console.log(setting);
        }
    });

    // 保存按钮点击事件处理程序
    saveButton.addEventListener('click', function() {
        let setting = {
            'collect_tag':collectTag.value
        };
        chrome.storage.local.set({ 'setting': setting }, function() {
            alert('设置已保存');
        });
    });
});
