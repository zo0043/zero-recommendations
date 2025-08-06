# 故障排除指南

本指南提供了搜索推荐词采集助手的常见问题解决方案和调试方法。

## 🔍 常见问题分类

### 1. 安装和加载问题

#### 问题：扩展无法安装
**症状：**
- Chrome提示"扩展程序无效"
- 显示"程序包无效"错误
- 扩展安装后立即消失

**解决方案：**
```bash
# 检查文件完整性
ls -la

# 检查manifest.json语法
cat manifest.json | jq .

# 确保所有必需文件存在
find . -name "*.js" -o -name "*.html" -o -name "*.css"
```

**排查步骤：**
1. 确保开启了开发者模式
2. 检查manifest.json语法是否正确
3. 确认所有必需文件都存在
4. 查看Chrome控制台错误信息

#### 问题：扩展加载失败
**症状：**
- 扩展显示为灰色
- 点击图标无响应
- 显示"已停用"状态

**解决方案：**
1. 重新加载扩展
2. 检查Chrome版本兼容性
3. 确认权限设置正确
4. 清除浏览器缓存

### 2. 功能性问题

#### 问题：采集无结果
**症状：**
- 点击提取后没有数据返回
- 显示"暂无采集结果"
- 导出文件为空

**排查步骤：**
```javascript
// 1. 检查网络连接
console.log('网络状态:', navigator.onLine);

// 2. 检查平台访问权限
console.log('当前域名:', window.location.hostname);

// 3. 检查选择器匹配
const searchInput = document.querySelector('input[name="search"]');
console.log('搜索框元素:', searchInput);

// 4. 检查推荐词元素
const recommendElements = document.querySelectorAll('.recommend-item');
console.log('推荐词元素:', recommendElements.length);
```

**解决方案：**
- 检查网络连接是否正常
- 确认目标平台可正常访问
- 尝试降低采集层级
- 检查关键词格式是否正确
- 更新平台选择器配置

#### 问题：导出功能失败
**症状：**
- 点击导出按钮无响应
- 文件下载失败
- 导出文件格式错误

**调试方法：**
```javascript
// 检查下载权限
if ('download' in document.createElement('a')) {
    console.log('支持下载功能');
} else {
    console.error('不支持下载功能');
}

// 检查文件内容
console.log('CSV内容:', csvContent);
console.log('文件大小:', new Blob([csvContent]).size);
```

**解决方案：**
- 确认浏览器下载权限
- 检查磁盘空间是否充足
- 尝试不同的浏览器
- 清除下载历史记录

### 3. ChatGPT集成问题

#### 问题：ChatGPT页面无法工作
**症状：**
- ChatGPT页面扩展不显示
- 关键词列表为空
- 生成功能无法启动

**排查步骤：**
```javascript
// 1. 检查是否在ChatGPT页面
console.log('当前URL:', window.location.href);
console.log('是否ChatGPT页面:', window.location.href.includes('chat.openai.com'));

// 2. 检查扩展权限
console.log('扩展权限:', chrome.runtime.id);

// 3. 检查DOM元素
const promptTextarea = document.querySelector('#prompt-textarea');
console.log('输入框元素:', promptTextarea);
```

**解决方案：**
- 确保ChatGPT页面正常加载
- 检查扩展权限设置
- 重新加载扩展
- 更新ChatGPT页面

#### 问题：文章生成失败
**症状：**
- 生成过程卡住
- 状态一直显示"生成中"
- 内容格式错误

**调试方法：**
```javascript
// 检查生成状态
chrome.storage.local.get('pga_keywords_dolist', function(result) {
    console.log('关键词列表:', result.pga_keywords_dolist);
});

// 检查生成时间
const generateTime = Date.now() - generateArticleStartTime;
console.log('生成耗时:', generateTime, 'ms');
```

**解决方案：**
- 检查网络连接稳定性
- 确认ChatGPT服务正常
- 重新启动生成任务
- 清理浏览器缓存

## 🔧 调试工具和方法

### 1. 控制台调试

#### 背景脚本调试
```javascript
// 在扩展管理页面控制台执行
chrome.runtime.getBackgroundPage(function(page) {
    console.log('Background page:', page);
    console.log('当前状态:', page.extractionData);
});

// 检查存储数据
chrome.storage.local.get(null, function(data) {
    console.log('所有存储数据:', data);
});
```

#### 内容脚本调试
```javascript
// 在目标页面控制台执行
chrome.runtime.sendMessage({type: 'test'}, function(response) {
    console.log('消息测试响应:', response);
});

// 检查DOM元素
function checkElements() {
    const elements = {
        searchInput: getNeetElement('search'),
        recommendElements: getNeetElement('recommend')
    };
    console.log('DOM元素状态:', elements);
}
```

#### 弹窗调试
```javascript
// 在弹窗控制台执行
console.log('当前标签页:', chrome.tabs.query({active: true}));
console.log('扩展设置:', chrome.storage.local.get('setting'));

// 检查消息传递
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('收到消息:', request);
});
```

### 2. 网络调试

#### 检查网络请求
```javascript
// 监听网络请求
const originalFetch = window.fetch;
window.fetch = function(...args) {
    console.log('Fetch请求:', args);
    return originalFetch.apply(this, args);
};

// 检查页面加载状态
window.addEventListener('load', function() {
    console.log('页面加载完成');
    console.log('加载时间:', performance.timing.loadEventEnd - performance.timing.navigationStart);
});
```

#### 检查平台访问
```javascript
// 检查跨域访问
function checkCrossOriginAccess() {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://www.example.com';
    iframe.onload = function() {
        console.log('跨域访问成功');
    };
    iframe.onerror = function() {
        console.error('跨域访问失败');
    };
    document.body.appendChild(iframe);
}
```

### 3. 存储调试

#### 检查存储数据
```javascript
// 检查所有存储数据
chrome.storage.local.get(null, function(data) {
    console.log('存储数据:', data);
    console.log('存储大小:', JSON.stringify(data).length, 'bytes');
});

// 检查特定键值
chrome.storage.local.get(['setting', 'keywords'], function(data) {
    console.log('设置:', data.setting);
    console.log('关键词:', data.keywords);
});
```

#### 清理存储数据
```javascript
// 清理特定数据
chrome.storage.local.remove(['current_extraction', 'active_tab_id'], function() {
    console.log('数据清理完成');
});

// 清理所有数据
chrome.storage.local.clear(function() {
    console.log('所有数据清理完成');
});
```

## 🛠️ 高级故障排除

### 1. 性能问题

#### 内存泄漏检测
```javascript
// 监控内存使用
function checkMemoryUsage() {
    if (performance.memory) {
        console.log('内存使用:', {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
        });
    }
}

// 定期检查内存
setInterval(checkMemoryUsage, 5000);
```

#### CPU使用率监控
```javascript
// 监控CPU使用
function checkCPUUsage() {
    const start = performance.now();
    
    // 执行一些操作
    for (let i = 0; i < 1000000; i++) {
        Math.random();
    }
    
    const end = performance.now();
    console.log('CPU耗时:', end - start, 'ms');
}
```

### 2. 兼容性问题

#### 浏览器版本检查
```javascript
// 检查Chrome版本
function checkChromeVersion() {
    const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/);
    if (chromeVersion) {
        const version = parseInt(chromeVersion[1]);
        console.log('Chrome版本:', version);
        
        if (version < 88) {
            console.warn('Chrome版本过低，建议升级到88+');
        }
    }
}

// 检查扩展API支持
function checkExtensionAPI() {
    const apis = [
        'chrome.runtime',
        'chrome.storage',
        'chrome.tabs',
        'chrome.scripting'
    ];
    
    apis.forEach(api => {
        if (eval(api)) {
            console.log('✓', api, '可用');
        } else {
            console.error('✗', api, '不可用');
        }
    });
}
```

### 3. 权限问题

#### 检查权限状态
```javascript
// 检查扩展权限
chrome.permissions.getAll(function(permissions) {
    console.log('当前权限:', permissions);
});

// 请求额外权限
chrome.permissions.request({
    permissions: ['activeTab', 'storage']
}, function(granted) {
    console.log('权限请求结果:', granted);
});
```

#### 检查内容脚本注入
```javascript
// 检查脚本是否已注入
function checkScriptInjection() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        console.log('✓ 扩展环境正常');
    } else {
        console.error('✗ 扩展环境异常');
    }
    
    // 检查自定义函数
    const functions = ['getNeetElement', 'inputDispatchEventEvent'];
    functions.forEach(func => {
        if (typeof window[func] === 'function') {
            console.log('✓', func, '可用');
        } else {
            console.error('✗', func, '不可用');
        }
    });
}
```

## 📊 日志分析

### 1. 启用详细日志
```javascript
// 设置日志级别
const LOG_LEVEL = 'debug'; // 'error', 'warn', 'info', 'debug'

function log(level, message, data) {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevel = levels.indexOf(LOG_LEVEL);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel <= currentLevel) {
        console[level](`[${level.toUpperCase()}]`, message, data);
    }
}

// 使用示例
log('debug', '调试信息', {key: 'value'});
log('info', '普通信息', {status: 'success'});
log('warn', '警告信息', {issue: 'potential problem'});
log('error', '错误信息', {error: 'something went wrong'});
```

### 2. 性能日志
```javascript
// 性能监控
function performanceMonitor() {
    const navigation = performance.timing;
    const metrics = {
        // 页面加载时间
        pageLoad: navigation.loadEventEnd - navigation.navigationStart,
        
        // DOM解析时间
        domParse: navigation.domComplete - navigation.domLoading,
        
        // 首次渲染时间
        firstPaint: navigation.responseEnd - navigation.fetchStart
    };
    
    console.log('性能指标:', metrics);
    
    // 检查性能问题
    if (metrics.pageLoad > 3000) {
        console.warn('页面加载时间过长:', metrics.pageLoad, 'ms');
    }
}
```

### 3. 错误追踪
```javascript
// 全局错误处理
window.addEventListener('error', function(event) {
    console.error('全局错误:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
    });
});

// Promise错误处理
window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise错误:', event.reason);
});

// 扩展错误处理
chrome.runtime.lastError && console.error('扩展错误:', chrome.runtime.lastError);
```

## 🔄 恢复和重置

### 1. 重置扩展状态
```javascript
// 重置所有设置
function resetExtension() {
    chrome.storage.local.clear(function() {
        console.log('扩展已重置');
        chrome.runtime.reload();
    });
}

// 重置特定设置
function resetSettings() {
    chrome.storage.local.remove(['setting', 'keywords'], function() {
        console.log('设置已重置');
    });
}
```

### 2. 重新安装扩展
```bash
# 1. 备份当前数据
cp -r zero-recommendations zero-recommendations-backup

# 2. 完全卸载扩展
# 在Chrome扩展管理页面移除扩展

# 3. 清理浏览器数据
# chrome://settings/clearBrowserData

# 4. 重新安装扩展
# 重新加载扩展程序
```

### 3. 恢复出厂设置
```javascript
// 恢复默认设置
const DEFAULT_SETTINGS = {
    level: 1,
    export_format: 'csv',
    auto_preview: true
};

function restoreDefaults() {
    chrome.storage.local.set({
        'setting': DEFAULT_SETTINGS
    }, function() {
        console.log('已恢复默认设置');
        location.reload();
    });
}
```

## 🆘 获取技术支持

### 1. 自助诊断
```javascript
// 运行完整诊断
function runDiagnostics() {
    console.log('=== 扩展诊断报告 ===');
    
    // 检查扩展状态
    console.log('扩展ID:', chrome.runtime.id);
    console.log('扩展版本:', chrome.runtime.getManifest().version);
    
    // 检查权限
    chrome.permissions.getAll(function(permissions) {
        console.log('权限状态:', permissions);
    });
    
    // 检查存储
    chrome.storage.local.get(null, function(data) {
        console.log('存储数据大小:', JSON.stringify(data).length, 'bytes');
    });
    
    // 检查当前页面
    console.log('当前页面:', window.location.href);
    console.log('页面标题:', document.title);
    
    console.log('=== 诊断完成 ===');
}
```

### 2. 生成错误报告
```javascript
// 生成错误报告
function generateErrorReport() {
    const report = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        extensionId: chrome.runtime.id,
        extensionVersion: chrome.runtime.getManifest().version,
        currentUrl: window.location.href,
        consoleErrors: [],
        storageData: {},
        permissions: []
    };
    
    // 收集控制台错误
    report.consoleErrors = Array.from(document.querySelectorAll('.error-message'))
        .map(el => el.textContent);
    
    // 收集存储数据
    chrome.storage.local.get(null, function(data) {
        report.storageData = Object.keys(data);
        
        // 收集权限信息
        chrome.permissions.getAll(function(permissions) {
            report.permissions = permissions.permissions;
            
            // 输出报告
            console.log('错误报告:', JSON.stringify(report, null, 2));
        });
    });
}
```

### 3. 联系支持
如果以上方法都无法解决问题，请：

1. **提交GitHub Issue**
   - 描述问题现象
   - 提供复现步骤
   - 附上错误日志
   - 说明运行环境

2. **联系技术支持**
   - 邮箱：niemingxing@example.com
   - 请包含诊断报告和错误日志

3. **社区支持**
   - 查看已知问题
   - 参与讨论
   - 分享解决方案

---

希望本指南能帮助您解决使用过程中遇到的问题。如需更多帮助，请随时联系技术支持团队。