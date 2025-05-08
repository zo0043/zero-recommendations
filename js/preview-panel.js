/**
 * 预览面板功能
 */

// 创建预览面板
function createPreviewPanel() {
    // 检查是否已存在预览面板
    if (document.getElementById('preview-panel')) {
        return document.getElementById('preview-panel');
    }
    
    // 创建预览面板容器
    const panel = document.createElement('div');
    panel.id = 'preview-panel';
    panel.className = 'preview-panel';
    
    // 创建面板头部
    const header = document.createElement('div');
    header.className = 'preview-header';
    
    // 创建标题
    const title = document.createElement('h3');
    title.textContent = '采集结果预览';
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'preview-close-btn';
    closeBtn.textContent = 'X';
    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
    });
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // 创建内容区域
    const content = document.createElement('div');
    content.className = 'preview-content';
    
    // 创建级别和关键词显示区域
    const levelInfo = document.createElement('div');
    levelInfo.className = 'level-info';
    levelInfo.innerHTML = '<strong>采集层级：</strong><span id="preview-level"></span>';
    
    const keywordsContainer = document.createElement('div');
    keywordsContainer.className = 'keywords-container';
    keywordsContainer.innerHTML = '<strong>搜索推荐词：</strong>';
    
    const keywordsList = document.createElement('div');
    keywordsList.id = 'preview-keywords-list';
    keywordsList.className = 'keywords-list';
    
    keywordsContainer.appendChild(keywordsList);
    
    content.appendChild(levelInfo);
    content.appendChild(keywordsContainer);
    
    // 创建按钮区域
    const actions = document.createElement('div');
    actions.className = 'preview-actions';
    
    // 导出CSV按钮
    const exportCsvBtn = document.createElement('button');
    exportCsvBtn.id = 'export-csv';
    exportCsvBtn.className = 'preview-btn';
    exportCsvBtn.textContent = '导出CSV';
    exportCsvBtn.addEventListener('click', exportToCsv);
    
    // 导出思维导图按钮
    const exportMindmapBtn = document.createElement('button');
    exportMindmapBtn.id = 'export-mindmap';
    exportMindmapBtn.className = 'preview-btn';
    exportMindmapBtn.textContent = '导出思维导图';
    exportMindmapBtn.addEventListener('click', exportToMindmap);
    
    actions.appendChild(exportCsvBtn);
    actions.appendChild(exportMindmapBtn);
    
    // 组装面板
    panel.appendChild(header);
    panel.appendChild(content);
    panel.appendChild(actions);
    
    // 添加到页面
    document.body.appendChild(panel);
    
    return panel;
}

// 显示预览面板
function showPreviewPanel(data) {
    const panel = createPreviewPanel();
    panel.style.display = 'block';
    
    // 更新采集层级
    document.getElementById('preview-level').textContent = data.level || '1';
    
    // 更新关键词列表
    const keywordsList = document.getElementById('preview-keywords-list');
    keywordsList.innerHTML = '';
    
    if (data.keywords && data.keywords.length > 0) {
        data.keywords.forEach(keyword => {
            const keywordItem = document.createElement('div');
            keywordItem.className = 'keyword-item';
            keywordItem.textContent = keyword[1]; // 假设关键词格式为 [level, keyword]
            keywordsList.appendChild(keywordItem);
        });
    } else {
        keywordsList.innerHTML = '<p>暂无采集结果</p>';
    }
}

// 导出为CSV
function exportToCsv() {
    // 从页面获取数据
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'export_csv' });
    });
}

// 导出为思维导图
function exportToMindmap() {
    // 从页面获取数据
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'export_mindmap' });
    });
}