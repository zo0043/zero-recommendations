// options.js
document.addEventListener('DOMContentLoaded', function() {
    var createPrompt = document.getElementById('createPrompt');
    var cleanPrompt = document.getElementById('cleanPrompt');
    var collectTag = document.getElementById('collectTag');
    var saveButton = document.getElementById('saveButton');


    // 获取保存的密钥值并设置输入框的默认值
    chrome.storage.local.get('setting', function(result) {
        let setting = result.setting;
        if (setting) {
            createPrompt.value = setting.create_prompt;
            cleanPrompt.value = setting.clean_prompt;
            collectTag.value = setting.collect_tag;

            console.log(setting);
        }
    });

    // 保存按钮点击事件处理程序
    saveButton.addEventListener('click', function() {
        let setting = {
            'create_prompt':createPrompt.value,
            'clean_prompt':cleanPrompt.value,
            'collect_tag':collectTag.value
        };
        chrome.storage.local.set({ 'setting': setting }, function() {
            alert('设置已保存');
        });
    });
});
