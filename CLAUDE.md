# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 Chrome 浏览器扩展项目，名为"搜索推荐词采集与内容生成助手"。主要功能是从多个平台（小红书、抖音、B站、知乎、百度、Google）提取搜索推荐词，并支持自动化内容生产。

## 技术架构

### 核心组件
- **manifest.json**: Chrome 扩展配置文件，定义权限、内容脚本和背景服务
- **background.js**: 背景服务脚本，处理跨标签页通信和数据收集
- **content-script.js**: 内容脚本，注入到目标页面执行关键词提取
- **popup.js/unified-extract.js**: 弹窗界面逻辑，处理用户交互
- **preview-panel.js**: 预览面板，展示提取结果

### 文件结构
```
├── js/                    # JavaScript 源代码
│   ├── background.js      # 背景服务脚本
│   ├── content-script.js  # 内容脚本
│   ├── popup.js          # 弹窗逻辑
│   ├── unified-extract.js # 统一提取界面
│   └── preview-panel.js   # 预览面板
├── css/                   # 样式文件
│   ├── theme.css         # 主题样式
│   ├── popup.css         # 弹窗样式
│   └── preview-panel.css # 预览面板样式
├── popup.html            # 传统弹窗界面
├── unified-extract.html  # 统一提取界面
├── options.html          # 配置页面
└── manifest.json         # 扩展配置
```

### 数据流
1. 用户在弹窗中输入关键词和层级
2. 消息发送到 background.js
3. background.js 打开目标页面并注入 content-script.js
4. content-script.js 执行关键词提取
5. 结果通过 background.js 返回到弹窗显示
6. 支持导出 CSV 和思维导图格式

## 开发工作流程

### 扩展加载
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录

### 调试方法
- **弹窗调试**: 右键点击扩展图标选择"检查"
- **背景脚本调试**: 在扩展管理页面点击"service worker"
- **内容脚本调试**: 在目标页面按 F12 打开开发者工具

### 文件修改后
修改任何文件后需要在扩展管理页面点击"重新加载"按钮使更改生效。

## 关键功能模块

### 关键词提取
- 支持多级关键词提取（1-3级）
- 支持占位符 `{c}` 自动替换为 A-Z
- 跨平台适配（小红书、抖音、B站、知乎、百度、Google）

### 数据导出
- CSV 格式导出
- Markdown 思维导图格式导出
- 文件保存在 `output/` 目录

### 配置系统
- 通过 `options.html` 配置采集标签
- 使用 Chrome Storage API 保存设置
- 支持自定义 CSS 选择器

## 注意事项

- 扩展需要相应平台的访问权限
- 不同平台的页面结构可能需要调整选择器
- 提取结果依赖于目标页面的 DOM 结构
- 需要处理跨域请求和页面加载异步问题