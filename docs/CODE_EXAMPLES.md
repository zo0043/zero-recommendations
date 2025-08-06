# 代码示例和配置指南

本文件提供了搜索推荐词采集助手的代码示例和配置示例，帮助开发者更好地理解和使用扩展。

## 🔧 配置示例

### 1. 扩展配置示例

#### manifest.json 完整配置
```json
{
  "manifest_version": 3,
  "name": "搜索推荐词采集与内容生成助手",
  "version": "1.3.0",
  "description": "支持多平台搜索推荐词提取和ChatGPT内容生成",
  "permissions": [
    "storage",
    "activeTab",
    "tabs",
    "scripting",
    "windows"
  ],
  "host_permissions": [
    "https://www.xiaohongshu.com/*",
    "https://www.douyin.com/*",
    "https://www.bilibili.com/*",
    "https://www.zhihu.com/*",
    "https://www.baidu.com/*",
    "https://www.google.com/*",
    "https://chat.openai.com/*"
  ],
  "background": {
    "service_worker": "js/background.js"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.xiaohongshu.com/*",
        "https://www.douyin.com/*",
        "https://www.bilibili.com/*",
        "https://www.zhihu.com/*",
        "https://www.baidu.com/*",
        "https://www.google.com/*",
        "https://chat.openai.com/*"
      ],
      "js": ["js/content-script.js"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "搜索推荐词采集助手"
  },
  "options_page": "options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "web_accessible_resources": [
    {
      "resources": ["js/preview-panel.js", "css/preview-panel.css"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

#### 用户设置配置
```javascript
// 默认设置
const DEFAULT_SETTINGS = {
  // 采集配置
  level: 2,                    // 默认采集层级
  delay: 3000,                 // 采集延迟(ms)
  max_results: 50,             // 最大结果数量
  
  // 导出配置
  export_format: 'csv',        // 导出格式: csv, markdown, both
  include_timestamp: true,     // 包含时间戳
  filename_template: 'keywords_{domain}_{date}', // 文件名模板
  
  // 界面配置
  auto_preview: true,          // 自动显示预览
  theme: 'light',              // 主题: light, dark
  language: 'zh-CN'           // 语言: zh-CN, en-US
};

// ChatGPT配置
const CHATGPT_SETTINGS = {
  auto_generate: true,         // 自动生成内容
  generate_prompt: '',         // 自定义提示词模板
  batch_size: 5,               // 批量处理大小
  timeout: 300000,             // 超时时间(ms)
  
  // 状态配置
  status_check_interval: 5000,  // 状态检查间隔(ms)
  max_retries: 3,              // 最大重试次数
  
  // 发布配置
  auto_publish: false,         // 自动发布
  publish_platform: '',        // 发布平台
  publish_delay: 10000         // 发布延迟(ms)
};
```

### 2. 平台选择器配置

#### 各平台DOM选择器
```javascript
const PLATFORM_SELECTORS = {
  'xiaohongshu.com': {
    name: '小红书',
    search: {
      input: '.search-input',
      button: '.search-button',
      clear: '.search-clear'
    },
    recommend: {
      container: '.search-suggest',
      items: '.sug-item',
      text: '.sug-item-text'
    },
    pagination: {
      next: '.next-page',
      loading: '.loading'
    },
    wait: {
      search: 2000,
      recommend: 1500,
      pagination: 1000
    }
  },
  
  'douyin.com': {
    name: '抖音',
    search: {
      input: 'header input[data-e2e="searchbar-input"]',
      button: 'header button[data-e2e="searchbar-button"]',
      clear: 'header .search-clear'
    },
    recommend: {
      container: 'header .search-suggest',
      items: 'header div[data-index]',
      text: 'div[data-index] span'
    },
    wait: {
      search: 3000,
      recommend: 2000
    }
  },
  
  'bilibili.com': {
    name: 'B站',
    search: {
      input: '.nav-search-input',
      button: '.nav-search-btn',
      clear: '.search-input-clear'
    },
    recommend: {
      container: '.suggestions',
      items: '.suggest-item',
      text: '.suggest-item-text'
    },
    wait: {
      search: 2500,
      recommend: 1500
    }
  },
  
  'zhihu.com': {
    name: '知乎',
    search: {
      input: 'form.SearchBar-tool input[type=text]',
      button: 'form.SearchBar-tool button',
      clear: '.SearchBar-clear'
    },
    recommend: {
      container: '.SearchBar-dropdown',
      items: '.Menu-item',
      text: '.Menu-item-content'
    },
    wait: {
      search: 2000,
      recommend: 1500
    }
  },
  
  'baidu.com': {
    name: '百度',
    search: {
      input: '#kw',
      button: '#su',
      clear: '.bdsug-clear'
    },
    recommend: {
      container: '#bdsug-box',
      items: 'ul li.bdsug-overflow',
      text: 'li.bdsug-overflow'
    },
    wait: {
      search: 1500,
      recommend: 1000
    }
  },
  
  'google.com': {
    name: 'Google',
    search: {
      input: 'form[role="search"] textarea',
      button: 'form[role="search"] button[aria-label="Google 搜索"]',
      clear: 'form[role="search"] button[aria-label="清除"]'
    },
    recommend: {
      container: 'ul[role="listbox"]',
      items: 'li[role="presentation"]',
      text: 'div[role="option"] div[role="presentation"]:first-child'
    },
    wait: {
      search: 2000,
      recommend: 1500
    }
  }
};
```

## 💻 代码示例

### 1. 关键词采集示例

#### 基础采集功能
```javascript
/**
 * 基础关键词采集函数
 * @param {string} keyword - 要搜索的关键词
 * @param {number} level - 采集层级
 * @param {boolean} showPreview - 是否显示预览
 */
async function basicKeywordCollection(keyword, level = 1, showPreview = false) {
  try {
    console.log(`开始采集关键词: ${keyword}, 层级: ${level}`);
    
    // 1. 获取搜索框
    const searchInput = getNeetElement('search');
    if (!searchInput) {
      throw new Error('未找到搜索框元素');
    }
    
    // 2. 输入搜索内容
    await inputSearch(searchInput, keyword);
    await sleep(2000);
    
    // 3. 获取推荐词
    const recommendElements = getNeetElement('recommend');
    const results = [];
    
    // 4. 处理推荐词
    for (const element of recommendElements) {
      const text = extractText(element);
      if (text) {
        results.push([1, text]); // [层级, 关键词]
        
        // 5. 如果需要二级采集
        if (level >= 2) {
          const level2Results = await secondaryCollection(text, level);
          results.push(...level2Results);
        }
      }
    }
    
    console.log(`采集完成，共获得 ${results.length} 个关键词`);
    
    // 6. 显示预览或导出
    if (showPreview) {
      showPreviewPanel({ level, keywords: results });
    } else {
      exportResults(results);
    }
    
    return results;
    
  } catch (error) {
    console.error('采集失败:', error);
    throw error;
  }
}

/**
 * 二级关键词采集
 * @param {string} keyword - 二级关键词
 * @param {number} maxLevel - 最大层级
 */
async function secondaryCollection(keyword, maxLevel) {
  const results = [];
  
  try {
    // 输入二级关键词
    const searchInput = getNeetElement('search');
    await inputSearch(searchInput, keyword);
    await sleep(2000);
    
    // 获取二级推荐词
    const recommendElements = getNeetElement('recommend');
    
    for (const element of recommendElements) {
      const text = extractText(element);
      if (text) {
        results.push([2, text]);
        
        // 如果需要三级采集
        if (maxLevel >= 3) {
          const level3Results = await tertiaryCollection(text);
          results.push(...level3Results);
        }
      }
    }
    
  } catch (error) {
    console.warn(`二级采集失败: ${keyword}`, error);
  }
  
  return results;
}
```

#### 批量采集功能
```javascript
/**
 * 批量关键词采集
 * @param {Array<string>} keywords - 关键词数组
 * @param {Object} options - 采集选项
 */
async function batchKeywordCollection(keywords, options = {}) {
  const {
    level = 1,
    delay = 3000,
    maxConcurrent = 3,
    showProgress = true,
    exportFormat = 'csv'
  } = options;
  
  const results = [];
  const total = keywords.length;
  let completed = 0;
  
  console.log(`开始批量采集，共 ${total} 个关键词`);
  
  // 分批处理关键词
  for (let i = 0; i < keywords.length; i += maxConcurrent) {
    const batch = keywords.slice(i, i + maxConcurrent);
    
    // 并发处理当前批次
    const batchPromises = batch.map(async (keyword) => {
      try {
        const result = await basicKeywordCollection(keyword, level, false);
        completed++;
        
        if (showProgress) {
          const progress = Math.round((completed / total) * 100);
          console.log(`进度: ${progress}% (${completed}/${total})`);
        }
        
        return { keyword, result, success: true };
      } catch (error) {
        completed++;
        console.error(`关键词 ${keyword} 采集失败:`, error);
        return { keyword, error: error.message, success: false };
      }
    });
    
    // 等待当前批次完成
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // 批次间延迟
    if (i + maxConcurrent < keywords.length) {
      await sleep(delay);
    }
  }
  
  // 导出结果
  await exportBatchResults(results, exportFormat);
  
  console.log('批量采集完成');
  return results;
}

/**
 * 导出批量采集结果
 * @param {Array} results - 采集结果
 * @param {string} format - 导出格式
 */
async function exportBatchResults(results, format) {
  const timestamp = new Date().toISOString().split('T')[0];
  
  if (format === 'csv' || format === 'both') {
    const csvContent = generateBatchCSV(results);
    downloadFile(csvContent, `batch_results_${timestamp}.csv`, 'text/csv');
  }
  
  if (format === 'json' || format === 'both') {
    const jsonContent = JSON.stringify(results, null, 2);
    downloadFile(jsonContent, `batch_results_${timestamp}.json`, 'application/json');
  }
}
```

### 2. ChatGPT集成示例

#### 文章生成功能
```javascript
/**
 * ChatGPT文章生成器
 * @param {Array<string>} keywords - 关键词数组
 * @param {Object} options - 生成选项
 */
class ChatGPTArticleGenerator {
  constructor(options = {}) {
    this.keywords = keywords;
    this.options = {
      autoGenerate: options.autoGenerate || true,
      promptTemplate: options.promptTemplate || '',
      delay: options.delay || 5000,
      maxRetries: options.maxRetries || 3,
      ...options
    };
    
    this.statusMap = {
      PENDING: 0,
      GENERATING: 1,
      COMPLETED: 2,
      PUBLISHED: 3,
      ERROR: -1
    };
    
    this.keywordStatus = new Map();
    this.initializeStatus();
  }
  
  /**
   * 初始化关键词状态
   */
  initializeStatus() {
    this.keywords.forEach(keyword => {
      this.keywordStatus.set(keyword, {
        status: this.statusMap.PENDING,
        content: '',
        error: null,
        retryCount: 0,
        timestamp: Date.now()
      });
    });
  }
  
  /**
   * 开始批量生成
   */
  async startGeneration() {
    console.log('开始批量生成文章');
    
    for (const keyword of this.keywords) {
      const status = this.keywordStatus.get(keyword);
      
      if (status.status === this.statusMap.PENDING) {
        await this.generateArticle(keyword);
      }
      
      // 生成间隔
      await sleep(this.options.delay);
    }
    
    console.log('批量生成完成');
    return this.getResults();
  }
  
  /**
   * 生成单个文章
   * @param {string} keyword - 关键词
   */
  async generateArticle(keyword) {
    const status = this.keywordStatus.get(keyword);
    status.status = this.statusMap.GENERATING;
    
    try {
      // 构建提示词
      const prompt = this.buildPrompt(keyword);
      
      // 输入到ChatGPT
      await this.inputToChatGPT(prompt);
      
      // 等待生成完成
      const content = await this.waitForCompletion(keyword);
      
      // 更新状态
      status.status = this.statusMap.COMPLETED;
      status.content = content;
      status.timestamp = Date.now();
      
      console.log(`文章生成完成: ${keyword}`);
      
    } catch (error) {
      console.error(`文章生成失败: ${keyword}`, error);
      
      // 重试逻辑
      if (status.retryCount < this.options.maxRetries) {
        status.retryCount++;
        status.status = this.statusMap.PENDING;
        console.log(`重试 ${status.retryCount}/${this.options.maxRetries}: ${keyword}`);
        
        // 重试延迟
        await sleep(this.options.delay * 2);
        await this.generateArticle(keyword);
      } else {
        status.status = this.statusMap.ERROR;
        status.error = error.message;
      }
    }
  }
  
  /**
   * 构建提示词
   * @param {string} keyword - 关键词
   */
  buildPrompt(keyword) {
    const template = this.options.promptTemplate || `
请为以下关键词写一篇详细的文章：

关键词：{keyword}

要求：
1. 内容要详细、实用
2. 结构清晰，包含引言、正文、结论
3. 字数在1000-2000字之间
4. 使用中文写作

请以以下格式回复：
[TITLE]
文章标题
[/TITLE]

[START:{keyword}]
文章内容
[END:{keyword}]
`;
    
    return template.replace(/{keyword}/g, keyword);
  }
  
  /**
   * 输入到ChatGPT
   * @param {string} prompt - 提示词
   */
  async inputToChatGPT(prompt) {
    const textarea = document.querySelector('#prompt-textarea');
    if (!textarea) {
      throw new Error('未找到ChatGPT输入框');
    }
    
    // 输入提示词
    await inputDispatchEventEvent(textarea, prompt);
    await sleep(1000);
    
    // 点击发送按钮
    const sendButton = document.querySelector('#prompt-textarea + button');
    if (sendButton) {
      sendButton.click();
    } else {
      throw new Error('未找到发送按钮');
    }
  }
  
  /**
   * 等待生成完成
   * @param {string} keyword - 关键词
   */
  async waitForCompletion(keyword) {
    return new Promise((resolve, reject) => {
      const maxWaitTime = 300000; // 5分钟
      const startTime = Date.now();
      
      const checkInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed > maxWaitTime) {
          clearInterval(checkInterval);
          reject(new Error('生成超时'));
          return;
        }
        
        // 检查是否完成
        const content = this.checkGenerationCompletion(keyword);
        if (content) {
          clearInterval(checkInterval);
          resolve(content);
        }
      }, 5000);
    });
  }
  
  /**
   * 检查生成是否完成
   * @param {string} keyword - 关键词
   */
  checkGenerationCompletion(keyword) {
    const messages = document.querySelectorAll('div[data-message-author-role="assistant"]');
    
    for (const message of messages) {
      const content = message.textContent;
      if (content.includes(`[START:${keyword}]`) && content.includes(`[END:${keyword}]`)) {
        return content;
      }
    }
    
    return null;
  }
  
  /**
   * 获取生成结果
   */
  getResults() {
    const results = [];
    
    this.keywordStatus.forEach((status, keyword) => {
      results.push({
        keyword,
        status: status.status,
        content: status.content,
        error: status.error,
        retryCount: status.retryCount,
        timestamp: status.timestamp
      });
    });
    
    return results;
  }
}
```

### 3. 工具函数示例

#### 事件模拟函数
```javascript
/**
 * 模拟用户输入事件
 * @param {HTMLElement} element - 目标元素
 * @param {string} value - 输入值
 */
async function inputDispatchEventEvent(element, value) {
  if (!element) {
    throw new Error('目标元素不存在');
  }
  
  // 创建事件
  const events = [
    new Event('focus', { bubbles: true, cancelable: true }),
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: value
    }),
    new Event('change', { bubbles: true, cancelable: true }),
    new KeyboardEvent('keyup', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    })
  ];
  
  // 设置值并触发事件
  element.value = value;
  element.focus();
  
  for (const event of events) {
    element.dispatchEvent(event);
  }
  
  console.log(`输入事件触发: ${value}`);
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 提取元素文本内容
 * @param {HTMLElement} element - 目标元素
 */
function extractText(element) {
  if (!element) return '';
  
  // 移除HTML标签
  let text = element.innerHTML.replace(/<[^>]*>/g, '');
  
  // 清理空白字符
  text = text.trim();
  
  // 移除多余空格
  text = text.replace(/\s+/g, ' ');
  
  return text;
}
```

#### 数据处理函数
```javascript
/**
 * 生成CSV内容
 * @param {Array} data - 数据数组
 * @param {Array} headers - 表头
 */
function generateCSVContent(data, headers = ['层级', '关键词']) {
  const csvRows = [];
  
  // 添加表头
  csvRows.push(headers.join(','));
  
  // 添加数据行
  data.forEach(row => {
    const csvRow = row.map(cell => {
      // 转义特殊字符
      const text = String(cell);
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    });
    csvRows.push(csvRow.join(','));
  });
  
  return csvRows.join('\n');
}

/**
 * 生成思维导图内容
 * @param {Array} data - 关键词数据
 */
function generateMindmapContent(data) {
  const groupedData = {};
  
  // 按层级分组
  data.forEach(([level, keyword]) => {
    if (!groupedData[level]) {
      groupedData[level] = [];
    }
    groupedData[level].push(keyword);
  });
  
  let content = '# 关键词思维导图\n\n';
  
  // 生成层级结构
  Object.keys(groupedData).sort().forEach(level => {
    content += `## 第${level}级关键词\n\n`;
    
    groupedData[level].forEach(keyword => {
      content += `- ${keyword}\n`;
    });
    
    content += '\n';
  });
  
  return content;
}

/**
 * 下载文件
 * @param {string} content - 文件内容
 * @param {string} filename - 文件名
 * @param {string} mimeType - MIME类型
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
  
  console.log(`文件已下载: ${filename}`);
}
```

### 4. 消息处理示例

#### 消息处理器
```javascript
/**
 * 扩展消息处理器
 */
class ExtensionMessageHandler {
  constructor() {
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
  }
  
  /**
   * 设置消息处理器
   */
  setupMessageHandlers() {
    // 采集关键词
    this.messageHandlers.set('collect_search_keywords', async (request, sender, sendResponse) => {
      try {
        const { keywords, level, showPreview } = request;
        const results = await basicKeywordCollection(keywords, level, showPreview);
        
        return { success: true, data: results };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    // 导出CSV
    this.messageHandlers.set('export_csv', async (request, sender, sendResponse) => {
      try {
        const csvContent = generateCSVContent(request.data);
        downloadFile(csvContent, 'keywords.csv', 'text/csv');
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    // 导出思维导图
    this.messageHandlers.set('export_mindmap', async (request, sender, sendResponse) => {
      try {
        const mindmapContent = generateMindmapContent(request.data);
        downloadFile(mindmapContent, 'keywords.md', 'text/markdown');
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    // ChatGPT文章生成
    this.messageHandlers.set('chatgpt_create_article', async (request, sender, sendResponse) => {
      try {
        const { keywords } = request;
        const generator = new ChatGPTArticleGenerator({ keywords });
        const results = await generator.startGeneration();
        
        return { success: true, data: results };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }
  
  /**
   * 处理消息
   */
  async handleMessage(request, sender, sendResponse) {
    const { type } = request;
    const handler = this.messageHandlers.get(type);
    
    if (!handler) {
      console.warn(`未知的消息类型: ${type}`);
      return { success: false, error: '未知的消息类型' };
    }
    
    try {
      const result = await handler(request, sender, sendResponse);
      return result;
    } catch (error) {
      console.error(`消息处理失败: ${type}`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 初始化消息监听
   */
  initialize() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse)
        .then(response => {
          if (sendResponse) {
            sendResponse(response);
          }
        })
        .catch(error => {
          console.error('消息处理错误:', error);
          if (sendResponse) {
            sendResponse({ success: false, error: error.message });
          }
        });
      
      return true; // 保持消息通道开放
    });
  }
}

// 使用示例
const messageHandler = new ExtensionMessageHandler();
messageHandler.initialize();
```

## 🎯 使用示例

### 1. 基础使用示例
```javascript
// 简单关键词采集
const keywords = ['手机推荐', '电脑评测'];
basicKeywordCollection(keywords[0], 2, true)
  .then(results => {
    console.log('采集结果:', results);
  })
  .catch(error => {
    console.error('采集失败:', error);
  });

// 批量采集
const batchKeywords = [
  '手机推荐{c}',
  '电脑评测{c}',
  '旅游攻略{c}'
];

batchKeywordCollection(batchKeywords, {
  level: 2,
  delay: 3000,
  maxConcurrent: 2,
  showProgress: true,
  exportFormat: 'both'
});
```

### 2. ChatGPT集成示例
```javascript
// 文章生成
const articleKeywords = [
  '人工智能发展趋势',
  '机器学习入门',
  '深度学习应用'
];

const generator = new ChatGPTArticleGenerator({
  keywords: articleKeywords,
  autoGenerate: true,
  delay: 8000,
  maxRetries: 3,
  promptTemplate: `
请为关键词 "{keyword}" 写一篇专业的技术文章。

要求：
1. 内容要专业、准确
2. 包含实际案例
3. 字数在1500-2500字之间

格式：
[TITLE]
文章标题
[/TITLE]

[START:{keyword}]
文章内容
[END:{keyword}]
`
});

generator.startGeneration()
  .then(results => {
    console.log('生成结果:', results);
  });
```

### 3. 自定义配置示例
```javascript
// 自定义采集配置
const customConfig = {
  selectors: {
    'example.com': {
      search: {
        input: '.search-input',
        button: '.search-btn'
      },
      recommend: {
        items: '.suggestion-item',
        text: '.suggestion-text'
      }
    }
  },
  settings: {
    level: 3,
    delay: 2000,
    exportFormat: 'json',
    includeTimestamp: true
  }
};

// 应用配置
chrome.storage.local.set({
  'setting': customConfig.settings,
  'custom_selectors': customConfig.selectors
});
```

---

这些代码示例和配置示例可以帮助开发者更好地理解和使用搜索推荐词采集助手。根据实际需求，您可以调整和扩展这些示例。