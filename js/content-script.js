let kwIndex = 0;
	// 创建一个空字符串用于拼接 CSV 内容
	let csvContent = "";
	let keywords = '';
	let keywordList = [];
	let collectKeywordList  = [];
	let collectLevel = 1;
	let currentDomain = window.location.hostname;
	let currentKeywords = "",currentKeywordsAliasTitle = '';
	let showPreview = false;

	// 监听来自popup的消息
	chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
		console.log('收到消息:', request);
		
		if (request.type === 'show_preview_panel' && request.data) {
			// 确保预览面板脚本已加载，然后显示预览面板
			ensurePreviewPanelLoaded(function(error) {
				if (error) {
					console.error('Error loading preview panel:', error.message);
					return;
				}
				// 显示预览面板
				if (typeof showPreviewPanel === 'function') {
					showPreviewPanel(request.data);
				} else {
					console.error('showPreviewPanel still not available after ensurePreviewPanelLoaded callback.');
				}
			});
			if (sendResponse) {
				sendResponse({status: 'success', message: '预览面板已显示'});
			}
		} else if (request.keywords && (request.type === 'collect_search_keywords' || request.type === 'chatgpt_create_article')) {
			// 如果是提取关键词请求
			console.log('收到提取关键词请求:', request);
			
			try {
				// 保存请求参数
				keywords = request.keywords;
				collectLevel = parseInt(request.level) || 1;
				showPreview = !!request.showPreview;
				
				// 如果有提取窗口ID，保存到storage中
				if (request.extractWindowId) {
					chrome.storage.local.set({
						'current_extraction': {
							windowId: request.extractWindowId,
							keywords: request.keywords,
							level: request.level,
							type: request.type,
							status: 'processing'
						}
					}, function() {
						console.log('提取参数已保存到storage');
					});
				}
				
				// 根据类型执行不同的提取操作
				if (request.type === 'collect_search_keywords') {
					// 收集搜索关键词
					keywordList = keywords.trim().split("\n");
					collectKeywordList = [];
					collectSearchKeywords(keywordList);
					
					if (sendResponse) {
						sendResponse({status: 'success', message: '开始提取搜索关键词'});
					}
				} else if (request.type === 'chatgpt_create_article') {
					// ChatGPT文章创建
					chatGptCreateArticle(keywords);
					
					if (sendResponse) {
						sendResponse({status: 'success', message: '开始创建ChatGPT文章'});
					}
				}
			} catch (e) {
				console.error('处理提取请求时出错:', e);
				if (sendResponse) {
					sendResponse({status: 'error', message: '处理提取请求时出错: ' + e.message});
				}
			}
		} else if (request.type === 'export_csv') {
			// 导出CSV
			try {
				downloadCSV();
				if (sendResponse) {
					sendResponse({status: 'success', message: 'CSV已导出'});
				}
			} catch (e) {
				console.error('导出CSV时出错:', e);
				if (sendResponse) {
					sendResponse({status: 'error', message: '导出CSV时出错: ' + e.message});
				}
			}
		} else if (request.type === 'export_mindmap') {
			// 导出思维导图
			try {
				downloadMindmap();
				if (sendResponse) {
					sendResponse({status: 'success', message: '思维导图已导出'});
				}
			} catch (e) {
				console.error('导出思维导图时出错:', e);
				if (sendResponse) {
					sendResponse({status: 'error', message: '导出思维导图时出错: ' + e.message});
				}
			}
		} else {
			// 未知消息类型
			if (sendResponse) {
				sendResponse({status: 'error', message: '未知的消息类型: ' + request.type});
			}
		}
		
		// 确保返回true以支持异步响应
		return true;
	});

	// For preview panel loading
	let isPreviewPanelScriptInjected = false;
	let isPreviewPanelScriptLoaded = false;
	let pendingPreviewCallbacks = [];
	
	// 发送预览数据到popup或提取窗口
	function sendPreviewData() {
	    const previewData = {
	        level: collectLevel,
	        keywords: collectKeywordList
	    };
        
        // 查找是否有提取窗口ID
        chrome.storage.local.get('current_extraction', function(data) {
            // 提取窗口ID存在且有效
            if (data && data.current_extraction && data.current_extraction.windowId) {
                console.log('向提取窗口发送数据，窗口ID:', data.current_extraction.windowId);
                try {
                    // 发送到background.js转发
                    chrome.runtime.sendMessage({
                        type: 'preview_data',
                        data: previewData,
                        extractWindowId: data.current_extraction.windowId
                    }, function(response) {
                        // 检查发送消息是否成功
                        if (chrome.runtime.lastError) {
                            console.error('向提取窗口发送数据失败:', chrome.runtime.lastError);
                        } else {
                            console.log('向提取窗口发送数据成功, 响应:', response);
                        }
                    });
                } catch (e) {
                    console.error('发送数据到提取窗口时出错:', e);
                }
            } else {
                console.log('没有找到提取窗口ID，向popup发送数据');
                // 向popup发送消息
                chrome.runtime.sendMessage({
                    type: 'preview_data',
                    data: previewData
                });
            }
            
            // 如果 showPreview 为 true，则直接显示预览面板
            if (showPreview) {
                showPreviewPanel(previewData);
            }
        });
	}
	
	// 动态加载CSS样式表
	function addStylesheet(cssPath) {
		const cssUrl = chrome.runtime.getURL(cssPath);
		if (document.querySelector(`link[rel="stylesheet"][href="${cssUrl}"]`)) {
			// console.log(`${cssPath} stylesheet already exists.`);
			return;
		}
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.type = 'text/css';
		link.href = cssUrl;
		document.head.appendChild(link);
		// console.log(`${cssPath} stylesheet added.`);
	}
	
	// 动态加载preview-panel.js脚本和CSS，并执行回调
	function ensurePreviewPanelLoaded(callback) {
	    // Callback signature: callback(error)

	    // 1. Load CSS (idempotent)
	    if (typeof addStylesheet === 'function') {
	        addStylesheet('css/preview-panel.css');
	    } else {
	        console.error('addStylesheet function is not defined.');
	        if (typeof callback === 'function') callback(new Error('addStylesheet missing'));
	        return;
	    }

	    // 2. If already loaded and function available
	    if (isPreviewPanelScriptLoaded && typeof showPreviewPanel === 'function') {
	        if (typeof callback === 'function') callback(null);
	        return;
	    }

	    // 3. If currently injecting/loading, add to queue
	    if (isPreviewPanelScriptInjected && !isPreviewPanelScriptLoaded) {
	        if (typeof callback === 'function') pendingPreviewCallbacks.push(callback);
	        return;
	    }

	    // 4. If not injected yet, inject it
	    if (!isPreviewPanelScriptInjected) {
	        isPreviewPanelScriptInjected = true; // Mark as "injection process started"
	        if (typeof callback === 'function') pendingPreviewCallbacks.push(callback);

	        const script = document.createElement('script');
	        script.src = chrome.runtime.getURL('js/preview-panel.js');
	        
	        script.onload = () => {
	            // console.log('preview-panel.js loaded successfully.');
	            if (typeof showPreviewPanel === 'function') {
	                isPreviewPanelScriptLoaded = true;
	                pendingPreviewCallbacks.forEach(cb => cb(null));
	            } else {
	                console.error('preview-panel.js loaded, but showPreviewPanel is not defined.');
	                pendingPreviewCallbacks.forEach(cb => cb(new Error('showPreviewPanel not defined post-load')));
	            }
	            pendingPreviewCallbacks = []; // Clear queue
	        };
	        
	        script.onerror = () => {
	            console.error('preview-panel.js failed to load.');
	            isPreviewPanelScriptInjected = false; // Allow re-attempt if needed
	            pendingPreviewCallbacks.forEach(cb => cb(new Error('preview-panel.js load failed')));
	            pendingPreviewCallbacks = []; // Clear queue
	        };
	        
	        document.head.appendChild(script);
	    }
	}
	let hasCompleteKeywords = [];
	let noCompleteKeywords = [];
	let statusMap = {0:"未处理",1:"已生成",2:"已发布",3:"生成中",4:"排队中",5:"采集完"};
	let statusColorClassMap = {0:'unresolved',1:'generated',2:'published',3:'generating',4:'queuing',5:'collect_completed'};
	let generateArticleTime = 0,generateArticleStartTime = 0;
	
	const downloadMarkdown = (content) => {
		const element = document.createElement('a');
		const file = new Blob([content], {type: 'text/markdown'});
		element.href = URL.createObjectURL(file);
		element.download = "data(" + currentDomain+ ").md";
		document.body.appendChild(element);
		element.click();
	};
	
	// 导出CSV文件
	const downloadCSV = () => {
		const element = document.createElement('a');
		const file = new Blob([csvContent], {type: 'text/csv'});
		element.href = URL.createObjectURL(file);
		element.download = "keywords_" + currentDomain + ".csv";
		document.body.appendChild(element);
		element.click();
	};
	
	// 导出思维导图（Markdown格式）
	const downloadMindmap = () => {
		// 创建思维导图内容（Markdown格式）
		let mindmapContent = `# ${keywords} 关键词思维导图\n\n`;
		
		// 按层级组织关键词
		const keywordsByLevel = {};
		
		collectKeywordList.forEach(item => {
			const level = item[0];
			const keyword = item[1];
			
			if (!keywordsByLevel[level]) {
				keywordsByLevel[level] = [];
			}
			
			keywordsByLevel[level].push(keyword);
		});
		
		// 生成思维导图内容
		Object.keys(keywordsByLevel).sort().forEach(level => {
			mindmapContent += `\n## 第${level}级关键词\n\n`;
			
			keywordsByLevel[level].forEach(keyword => {
				mindmapContent += `- ${keyword}\n`;
			});
		});
		
		// 下载思维导图文件
		const element = document.createElement('a');
		const file = new Blob([mindmapContent], {type: 'text/markdown'});
		element.href = URL.createObjectURL(file);
		element.download = "mindmap_" + currentDomain + ".md";
		document.body.appendChild(element);
		element.click();
	};
	/**
	 * 获取必要的dom对象
	 * @param $type
	 * @returns {Element | NodeListOf<Element>}
	 */
	function getNeetElement($type)
	{
		let result;
		if($type == "search")
		{
			if(currentDomain.includes("douyin"))
			{
				result = document.querySelector('header input[data-e2e="searchbar-input"]');
			}
			else if(currentDomain.includes("xiaohongshu"))
			{
				result = document.querySelector('.search-input');
			}
			else if(currentDomain.includes("bilibili"))
			{
				result = document.querySelector('.nav-search-input');
			}
			else if(currentDomain.includes("zhihu"))
			{
				result = document.querySelector('form.SearchBar-tool input[type=text]');
			}
			else if(currentDomain.includes("baidu"))
			{
				result = document.querySelector('#kw');
			}
			else if(currentDomain.includes("google"))
			{
				result = document.querySelector('form[role="search"] textarea');
			}

		}
		else if($type == "recommend")
		{
			if(currentDomain.includes("douyin"))
			{
				result = document.querySelectorAll("header div[data-index]");
			}
			else if(currentDomain.includes("xiaohongshu"))
			{
				result = document.querySelectorAll("div.sug-item");
			}
			else if(currentDomain.includes("bilibili"))
			{
				result = document.querySelectorAll("div.suggestions div.suggest-item");
			}
			else if(currentDomain.includes("zhihu"))
			{
				result = document.querySelectorAll('div.Menu-item');
			}
			else if(currentDomain.includes("baidu"))
			{
				result = document.querySelectorAll('ul li.bdsug-overflow');
			}
			else if(currentDomain.includes("google"))
			{
				result = document.querySelectorAll('ul[role="listbox"] li[role="presentation"] div[role="option"] div[role="presentation"]:first-child');
			}
		}

		return result;
	}

	/**
	 * 搜索关键词
	 * @param keywords
	 */
	async function search(q)
	{
		csvContent += "1," + q + "\n";
		collectKeywordList.push([1,q]);
		let searchInput = getNeetElement("search");
		if (searchInput) {
			inputDispatchEventEvent(searchInput,q);
			await sleep(3000);
			let recommendElements = getNeetElement("recommend");
			// 遍历每个 div 元素并输出其 TEXT 内容
			for (let element of recommendElements) {
				let html = element.innerHTML;
				let text = html.replace(/<[^>]*>/g, "");
				csvContent += "2," + text + "\n";
				collectKeywordList.push([2,text]);
				//获取3级关键词搜索结果
				if(collectLevel >= 2)
				{
					let keywords = await getSearchKeywords(text);
					console.log(keywords);
					for (let kw of keywords) {
						csvContent += "3," + kw + "\n";
						collectKeywordList.push([3,kw]);
						//获取4级关键词搜索结果
						if(collectLevel >= 3)
						{
							let keywords2 = await getSearchKeywords(kw);
							console.log(keywords2);
							for (let kw2 of keywords2) {
								csvContent += "4," + kw2 + "\n";
								collectKeywordList.push([4,kw2]);
							}
						}
					}
				}
				console.log(text);
			}
			
			// 如果启用了预览，发送数据到popup
			if(showPreview) {
				sendPreviewData();
			}
			
			kwIndex++;
			if(kwIndex >= keywordList.length)
			{
				// 如果启用了预览，只发送预览数据，不自动下载文件
				if(showPreview) {
					console.log("采集完成，已发送预览数据");
					// 确保最后一次发送完整的预览数据
					sendPreviewData();
					return;
				} else {
					// 如果没有启用预览，则按原来的方式下载文件
					let markdown = convertToXMindMarkdown(collectKeywordList);
					downloadMarkdown(markdown);
					console.log(markdown);
					saveCsv(csvContent);
				}
				return;
			}
			await searchByCharCode();
		}
	}

	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	async function getSearchKeywords(q) {
		let searchInput = getNeetElement("search");
		inputDispatchEventEvent(searchInput,q);
		await sleep(3000);
		let recommendElements = getNeetElement("recommend");
		let keywords = [];
		for (let element of recommendElements) {
			let html = element.innerHTML;
			let text = html.replace(/<[^>]*>/g, "");
			keywords.push(text);
		}
		return keywords;
	}

	/**
	 * 保存内容为csv文件
	 * @param csvContent
	 */
	function saveCsv(csvContent)
	{
		// 创建一个 Blob 对象，将内容保存为 CSV 文件
		var blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });

		// 生成一个临时下载链接并下载文件
		var link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = "data(" + currentDomain+ ").csv";
		link.click();
	}

	function convertToXMindMarkdown(data) {
		let markdown = '# 采集助手\n';
		
		data.forEach((item, index) => {
			let len = item[0] + 1;
			for (let i = 0; i < len; i++) {
				markdown += '#';
			}
			
			markdown += ` ${item[1]}\n`;
		});
		
		return markdown;
	}

	/**
	 * 把数组转换成csv内容
	 * @param data
	 * @returns {string}
	 */
	function convertToCSVContent(data,header=[],keysArr = []) {
		let pHeader = header.length == 0 ? ["关键词", "内容"] : header;
		let pKeysArr = keysArr.length ==0 ? ["title", "content"] : keysArr;
		const rows = data.map(row => pKeysArr.map(key => formatCSVValue(row[key])).join(","));
		return [pHeader.join(",")].concat(rows).join("\n");
	}

	/**
	 * 格式化csv内容特殊字符
	 * @param value
	 * @returns {string}
	 */
	function formatCSVValue(value) {
		if (typeof value === 'string') {
			if (/[",\n\t]/.test(value)) {
				value = value.replace(/"/g, '""');
				value = `"${value}"`;
			}
		}
		return value;
	}

	async function searchByCharCode()
	{
		let kw = keywordList[kwIndex];
		await search(kw);
	}


	/**
	 * 收集搜索推荐词
	 * @param data
	 */
	async function collectSearchKeywords(data)
	{
		if (data.keywords) {
			// 将关键词信息展示在页面的搜索框中
			//console.log(message)
			window.focus();
			csvContent = "";
			kwIndex = 0;
			keywords = data.keywords;
			keywordList = [];
			// 设置是否显示预览
			showPreview = data.showPreview || false;
			// 设置采集层级
			if (data.level) {
				collectLevel = parseInt(data.level);
			}
			// 修改表头为 "推荐关键词"
			let headers = ["层级","推荐关键词"];
			csvContent += headers.join(",") + "\n";
			//关键词处理
			let kwList = keywords.split("\n").filter(function(item) {
				return item.trim() !== "";
			});
			//判断是否有占位符，存在替换为26个字母
			kwList.forEach(item => {
				if(item.includes("{c}")) {
					keywordList.push(item.replace("{c}", ""));
					for (let i = 97; i <= 122; i++) {
						let character = String.fromCharCode(i);
						keywordList.push(item.replace("{c}", character));
					}
				} else {
					keywordList.push(item);
				}
			});

			console.log(keywordList);
			console.log(kwIndex);
			console.log("预览模式：" + (showPreview ? "开启" : "关闭"));
			await searchByCharCode();
			console.log("收集关键词数组：" + collectKeywordList);
			sendPreviewData(); // 确保在采集完成后调用，以显示预览面板
		}
	}
	
	/**
	 * input对象输入、改变、键盘事件分发
	 * @param obj
	 * @param value
	 */
	function inputDispatchEventEvent(obj,value)
	{
		let focusEvent = new Event('focus', {
			bubbles: true,
			cancelable: true
		});
		let inputEvent = new InputEvent('input', {
			bubbles: true,
			cancelable: true,
			inputType: 'insertText',
			data:value
		});
		let changeEvent = new Event('change', {
			bubbles: true,
			cancelable: true
		});
		let keyUpEvent = new KeyboardEvent('keyup', {
			key: '',
			bubbles: true,
			cancelable: true
		});
		obj.value = value;
		obj.focus();
		obj.dispatchEvent(focusEvent);
		obj.dispatchEvent(inputEvent);
		obj.dispatchEvent(changeEvent);
		obj.dispatchEvent(keyUpEvent);
		console.log(value + "触发搜索");
	}

	/**
	 * 利用ChatGpt根据关键词创建文章
	 * @param data
	 */
	function chatGptCreateArticle(data)
	{
		window.focus();
		//hasCompleteKeywords = [];
		//noCompleteKeywords = [];
		keywords = data.keywords;
		keywordList = keywords.split("\n").filter(function(value, index, self) {
			// 过滤掉空字符串和重复元素
			return value.trim() !== "" && self.indexOf(value) === index;
		});
		chrome.storage.local.get('pga_keywords_dolist', function(result) {
			let doList = result.hasOwnProperty("pga_keywords_dolist") ? result.pga_keywords_dolist : {};
			for (var i = 0; i < keywordList.length; i++) {
				//status:0-未处理，1-已完成，2-已发布
				if (!doList.hasOwnProperty(keywordList[i])) {
					doList[keywordList[i]] = {'keywords':keywordList[i],'alias_title':'','status':0,'content':'','timestamp':new Date().getTime()}
					addKeywordListItemElement({'title':keywordList[i],'alias_title':'','status_text':statusMap[0],'status':0},2);
				}
			}
			chrome.storage.local.set({ 'pga_keywords_dolist': doList }, function() {
				console.log('关键词组存储成功！');
				initCreateStatus();
			});
		});
	}

	/**
	 * 发送prompt请求
	 */
	function sendCreatePrompt(type = 1,data = '')
	{
		let prompt_textarea = document.querySelector('#prompt-textarea');
		if(prompt_textarea) {
			//点击按钮发送prompt
			let prompt_button = document.querySelector('#prompt-textarea + button');
			if(type ==1)
			{
				let prompt = "";
				if(checkIsUrl(currentKeywords))
				{
					prompt = '';
					prompt = prompt.replace(/{url}/g, currentKeywords);
					prompt = prompt.replace("{content}", data);
				}
				else
				{
					// 由于移除了createPrompt，这里不再处理非URL的情况
					console.log("createPrompt已被移除，无法处理非URL的情况");
					return;
				}
				inputDispatchEventEvent(prompt_textarea, prompt);
				setTimeout(function (){
					prompt_button.click();
				},500);
				updateKeywordsListItemElement(currentKeywords,{'title':currentKeywords,'status':3,'status_text':statusMap[3]});
				generateArticleStartTime = new Date().getTime();
			}
			else if(type == 2)
			{
				if(prompt_textarea.value.trim() != "")
				{
					prompt_button.click();
					generateArticleStartTime = new Date().getTime();
				}
			}
		}
		else{
			//网络错误异常容错
			let buttons = document.querySelectorAll('form div button');
			for (var i = 0; i < buttons.length; i++) {
				let buttonText = buttons[i].innerText;
				if (buttonText.includes("Regenerate response")) {
					console.log("存在按钮 'Regenerate response' 自动点击继续!");
					buttons[i].click();
					break;
				}
			}
		}
	}

	function sendWebSpiderRequest(url)
	{
		chrome.runtime.sendMessage({ 'type': 'web_spider_collect',"url":url });
	}

	/**
	 * 初始化关键词文章创建状态
	 */
	function initCreateStatus()
	{
		let keywordsContent = {};
		for (var i = 0; i < keywordList.length; i++) {
			let keywords = keywordList[i];
			let hasComplete = false;
			let ckRes = checkHasCompleteKeywords(keywords);
			if(ckRes['has_complete'])
			{
				hasComplete = true;
				keywordsContent[keywords]=ckRes['content'];
			}
			if(hasComplete)
			{
				hasCompleteKeywords.push(keywords);
			}
			else
			{
				noCompleteKeywords.push(keywords);
				updateKeywordsListItemElement(keywords,{'title':keywords,'status_text':statusMap[4],'status':4});
			}
		}
		console.log(hasCompleteKeywords);
		console.log(noCompleteKeywords);
		chrome.storage.local.get('pga_keywords_dolist', function(result) {
			let doList = result.pga_keywords_dolist;
			for (var i = 0; i < hasCompleteKeywords.length; i++) {
				if(doList.hasOwnProperty(hasCompleteKeywords[i]))
				{
					if(doList[hasCompleteKeywords[i]]['status'] == 0)
					{
						doList[hasCompleteKeywords[i]]['status'] = 1;
						doList[hasCompleteKeywords[i]]['content'] = keywordsContent[hasCompleteKeywords[i]];
						updateKeywordsListItemElement(hasCompleteKeywords[i],{'title':hasCompleteKeywords[i],'status_text':statusMap[1],'status':1});
					}
				}
				else
				{
					doList[hasCompleteKeywords[i]]['status'] = 1;
					doList[hasCompleteKeywords[i]]['content'] = keywordsContent[hasCompleteKeywords[i]];
					doList[hasCompleteKeywords[i]]['timestamp'] = new Date().getTime();
					addKeywordListItemElement({'title':hasCompleteKeywords[i],'status_text':statusMap[1],'status':1});
				}
			}
			chrome.storage.local.set({ 'pga_keywords_dolist': doList }, function() {
				console.log("初始化关键词完成状态！");
				document.querySelector("#gpt-sr-toggleButton").click();
			});
		});
	}

	/**
	 * 查看关键字文章是否已经完成
	 * @param keywords
	 */
	function checkHasCompleteKeywords(keywords)
	{
		//let items = document.querySelectorAll('div.group.w-full div.markdown.prose.w-full');
		let items = document.querySelectorAll("div[data-message-author-role=\"assistant\"] div.markdown.prose.w-full");

		let hasComplete = false;
		let content = '';
		//根据页面内容判断关键词文章是否生成
		for (var j = 0; j < items.length; j++) {
			let text = items[j].innerText;
			//console.log(text);
			if (text.includes("[START:"+keywords+"]") && text.includes("[END:"+keywords+"]")) {
				hasComplete = true;
				content = text;
				console.log("["+keywords+"] 文章创建完成！",content);
			}
		}
		return {
			'has_complete':hasComplete,
			'content':content
		}
	}

	/**
	 * 解析GPT生成的内容
	 * @param keywords
	 * @param content
	 * @returns {{title: string, content}}
	 */
	function parseContent(keywords,content)
	{
		//var regex = /\[TITLE\](.*?)\[\/TITLE\]/;
		var regex = /\[TITLE\]([\s\S]*?)\[\/TITLE\]/;
		var matches = content.match(regex);
		let title='';
		if (matches && matches.length > 1) {
			title = matches[1];
		} else {
			console.log("未找到匹配的内容");
		}
		let replaceStrArr = ["[START:"+keywords+"]","[END:"+keywords+"]","[TITLE]"+title+"[/TITLE]"];
		for(var i=0; i<replaceStrArr.length;i++)
		{
			content = content.replace(replaceStrArr[i],"");
		}
		return {
			'title':title,
			'content':content
		};
	}

	/**
	 * 定时检查关键词完成状况
	 */
	function checkCreateStatus()
	{
		let intervalId = setInterval(function(){
			let content = '';
			let ckRes = checkHasCompleteKeywords(currentKeywords);
			if(ckRes['has_complete'])
			{
				content = ckRes['content'];
				chrome.storage.local.get('pga_keywords_dolist', function(result) {
					let doList = result.pga_keywords_dolist;
					if(doList.hasOwnProperty(currentKeywords))
					{
						if(doList[currentKeywords]['status'] == 0)
						{
							doList[currentKeywords]['status'] = 1;
							doList[currentKeywords]['content'] = content;
							doList[currentKeywords]['alias_title'] = currentKeywordsAliasTitle;
							updateKeywordsListItemElement(currentKeywords,{'title':currentKeywords,'status_text':statusMap[1],'status':1});
						}
					}
					else
					{
						doList[currentKeywords]['status'] = 1;
						doList[currentKeywords]['content'] = content;
						doList[currentKeywords]['timestamp'] = new Date().getTime();
						doList[currentKeywords]['alias_title'] = currentKeywordsAliasTitle;
						addKeywordListItemElement({'title':currentKeywords,'alias_title':currentKeywordsAliasTitle,'status_text':statusMap[1],'status':1});
					}
					chrome.storage.local.set({ 'pga_keywords_dolist': doList }, function() {
						generateArticleTime = new Date().getTime() - generateArticleStartTime;
						console.log("["+currentKeywords+"] 完成持久化状态变更，消耗" + generateArticleTime/1000 +"秒！");
						let parseData = parseContent(currentKeywords,content);
						parseData['keywords'] = currentKeywords;
						sendArticlePublishRequest({'type':'publish_article',"data":parseData});
						while (true) {
							if(noCompleteKeywords.length === 0)
							{
								console.log("所有关键词文章全部生成完成！");
								document.querySelector("button.gpt-sr-starting-btn").disabled = false;
								clearInterval(intervalId);
								if(window.Notification && Notification.permission !== "denied") {
									Notification.requestPermission(function(status) {
										var n = new Notification('任务完成通知', { body: "所有关键词文章全部生成完成！" });
									});
								}
								return;
							}
							currentKeywords = noCompleteKeywords.shift();
							if(doList[currentKeywords]['status'] == 0)
							{
								if(checkIsUrl(currentKeywords))
								{
									sendWebSpiderRequest(currentKeywords);
								}
								else
								{
									sendCreatePrompt();
								}
								return;
							}
						}
					});
				});
			}

			if(new Date().getTime() - generateArticleStartTime > 300000)
			{
				if(window.Notification && Notification.permission !== "denied") {
					Notification.requestPermission(function(status) {
						var n = new Notification('异常通知', { body: "[" + currentKeywords + "] 文章生成异常，请及时排查问题！" });
					});
				}
			}

			let buttons = document.querySelectorAll('form div button');
			for (var i = 0; i < buttons.length; i++) {
				let buttonText = buttons[i].innerText;
				if (buttonText.includes("Continue generating")) {
					console.log("存在按钮 'Continue generating' 自动点击继续!");
					buttons[i].click();
					break;
				}
				//"Stop generating"
			}
			//容错由于程序响应过快导致按钮没有及时触发
			sendCreatePrompt(2);
		},5000);
	}

	chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
		console.log(message);
		if(message.type == 'collect_search_keywords')
		{
			// 设置采集层级和预览标志
			if (message.level) {
				collectLevel = parseInt(message.level);
			}
			showPreview = message.showPreview || false;
			collectSearchKeywords(message);
		}
		else if(message.type == "export_csv") {
			// 导出CSV文件
			downloadCSV();
		}
		else if(message.type == "export_mindmap") {
			// 导出思维导图
			downloadMindmap();
		}
		else if(message.type == 'chatgpt_create_article')
		{
			console.log("利用chatgpt生成文章");
			chatGptCreateArticle(message);
		}
		else if(message.type == 'pga_keywords_publish')
		{
			updateKeywordsListItemElement(message.data['keywords'],{'title':message.data['keywords'],'status':message.data['status'],'status_text':statusMap[message.data['status']]});
		}
		else if(message.type == 'web_spider_complete')
		{
			if(message.data.content == "")
			{
				alert("采集异常：采集内容为空！");
				return;
			}
			currentKeywordsAliasTitle = message.data.title;
			updateKeywordsListItemElement(currentKeywords,{'title':currentKeywords,'alias_title':message.data.title,'status':5,'status_text':statusMap[5]});
			sendCreatePrompt(1,message.data.content);
		}
		else if(message.type == 'show_preview_panel') {
			// 在页面中显示预览面板
			console.log('显示预览面板:', message.data);
			// 调用preview-panel.js中的showPreviewPanel函数
			if (typeof showPreviewPanel === 'function') {
				showPreviewPanel(message.data);
			} else {
				console.error('showPreviewPanel函数未定义');
				// 尝试加载preview-panel.js
				loadPreviewPanelScript();
			}
		}
	});

	/**
	 * 发送文章发布请求
	 * @param data
	 */
	function sendArticlePublishRequest(data) {
		chrome.runtime.sendMessage(data, function (response) {
			console.log(response.farewell)
		});
	}

	/**
	 * 初始化弹层
	 */
	function initKeywrodsPopup() {
		const keywrodsHtmlLayer = '<div class="gpt-sr-container">\n' +
			'    <div class="gpt-sr-sidebar">\n' +
			'      <button id="gpt-sr-toggleButton">主题列表</button>\n' +
			'    </div>\n' +
			'  </div>\n' +
			'  \n' +
			'  <div id="gpt-sr-popup" class="gpt-sr-popup">\n' +
			'    <button class="gpt-sr-close-btn">&times;</button>\n' +
			'	 <button class="gpt-sr-starting-btn">开始执行</button>\n' +
			'	 <button class="gpt-sr-download-btn">下载数据</button>\n' +
			'    <div class="gpt-sr-content">\n' +
			'      <h2 class="gpt-sr-title">关键词列表</h2>\n' +
			'      <ul class="gpt-sr-list">\n' +
			'      </ul>\n' +
			'    </div>\n' +
			'  </div>';
		const popupElement = document.createElement("div");
		popupElement.innerHTML = keywrodsHtmlLayer;
		document.body.appendChild(popupElement);
		document.querySelector("#gpt-sr-toggleButton").addEventListener("click", function() {
			var popup = document.getElementById("gpt-sr-popup");
			popup.classList.toggle("gpt-sr-active");
		});

		document.querySelector("button.gpt-sr-close-btn").addEventListener("click", function() {
			var popup = document.getElementById("gpt-sr-popup");
			popup.classList.remove("gpt-sr-active");
		});

		document.querySelector("button.gpt-sr-starting-btn").addEventListener("click", function() {
			if(noCompleteKeywords.length == 0)
			{
				alert("没有待处理的关键词");
			}
			else
			{
				var currentElement = event.target;
				currentElement.disabled = true;
				currentKeywords = noCompleteKeywords.shift();
				generateArticleStartTime = new Date().getTime();
				if(checkIsUrl(currentKeywords))
				{
					console.log(currentKeywords);
					sendWebSpiderRequest(currentKeywords);
					checkCreateStatus();
				}
				else
				{
					sendCreatePrompt();
					checkCreateStatus();
				}
			}
		});


		document.querySelector("button.gpt-sr-download-btn").addEventListener("click", function() {
			chrome.storage.local.get('pga_keywords_dolist', function(result) {
				let doList = result.pga_keywords_dolist;
				let sortedKeys = Object.keys(doList).sort(function(a, b) {
					let timestampA = doList[a].timestamp;
					let timestampB = doList[b].timestamp;
					return timestampB - timestampA;
				});
				let downloadData = [];
				sortedKeys.forEach(function(key) {
					if (doList.hasOwnProperty(key)) {
						if(doList[key].hasOwnProperty("alias_title") && doList[key]['alias_title'] != "")
						{
							downloadData.push({"title":doList[key]['alias_title'],"content":doList[key]['content']});
						}
						else
						{
							downloadData.push({"title":key,"content":doList[key]['content']});
						}
					}
				});
				console.log(downloadData);
				let csvContent = convertToCSVContent(downloadData);
				saveCsv(csvContent);
			});
		});

		document.addEventListener('click', function(event) {
			var toggleButton = document.getElementById('gpt-sr-toggleButton');
			var popup = document.getElementById('gpt-sr-popup');

			// 判断点击的目标元素是否在弹层内部
			var isInsidePopup = popup.contains(event.target);

			// 判断点击的目标元素是否是弹层按钮
			var isToggleButton = (event.target === toggleButton);

			// 如果点击的目标元素不在弹层内部且不是弹层按钮，则隐藏弹层
			if (!isInsidePopup && !isToggleButton) {
				popup.classList.remove("gpt-sr-active");
			}
		});

		chrome.storage.local.get('pga_keywords_dolist', function(result) {
			let doList = result.hasOwnProperty("pga_keywords_dolist") ? result.pga_keywords_dolist : {};
			let sortedKeys = Object.keys(doList).sort(function(a, b) {
				let timestampA = doList[a].timestamp;
				let timestampB = doList[b].timestamp;
				return timestampB - timestampA;
			});

			sortedKeys.forEach(function(key) {
				if (doList.hasOwnProperty(key)) {
					let data = {
						'title' : key,
						'alias_title':doList[key]['alias_title'],
						'status_text' : statusMap[doList[key]['status']],
						'status':doList[key]['status']
					};
					//console.log(data);
					addKeywordListItemElement(data);
				}
			});
		});

		chrome.storage.local.get('setting', function (data) {
			// 确保data.setting存在，避免TypeError
			if (!data || !data.setting) {
				data = { setting: {} };
			}
			
			createPrompt = (typeof data.setting.create_prompt !== 'undefined') ? data.setting.create_prompt : '';
			
			collectLevel = (typeof data.setting.level !== 'undefined') ? parseInt(data.setting.level, 10) : 1;
			console.log('Setting initialized');
			chrome.runtime.sendMessage({"type":"init_setting","setting":data.setting}, function (response) {
				console.log(response.farewell)
			});
		});
	}

	/**
	 * 创建关键词列表对象
	 * @param data
	 * @returns {HTMLLIElement}
	 */
	function addKeywordListItemElement(data,type = 1)
	{
		let titleHtml = data.title;
		if(checkIsUrl(data.title))
		{
			titleHtml = "<a href='" + data.title + "' target='_blank'>" + data.title + "</a>";
			if(data.hasOwnProperty("alias_title") && data['alias_title'] != "")
			{
				titleHtml = "<a href='" + data.title + "' target='_blank'>" + data['alias_title'] + "</a>";
			}
		}
		let itemHtml = '<span class="gpt-sr-keyword" title="' + data.title + '">' + titleHtml + '</span>\n' +
			'<span class="gpt-sr-status ' + statusColorClassMap[data.status] + '">' + data.status_text + '</span>\n' +
			'<div class="gpt-sr-actions"><button class="gpt-sr-add" title="加入生成">+</button><button class="gpt-sr-delete" title="删除记录">-</button></div>';
		const itemElement = document.createElement("li");
		itemElement.classList.add("gpt-sr-list-item");
		itemElement.setAttribute("data-key", data.title);
		itemElement.innerHTML = itemHtml;
		itemElement.querySelector("div.gpt-sr-actions button.gpt-sr-delete").addEventListener("click", function() {
			var currentElement = event.target;
			currentElement.disabled = true;
			var liParentElement = currentElement.parentNode.parentNode;
			let liKeywords = liParentElement.getAttribute("data-key");
			chrome.storage.local.get('pga_keywords_dolist', function(result) {
				let doList = result.pga_keywords_dolist;
				delete doList[liKeywords];
				chrome.storage.local.set({ 'pga_keywords_dolist': doList }, function() {
					liParentElement.remove();
					updateKewordsListStatistics();
				});
			});
		});
		const addButton = itemElement.querySelector("div.gpt-sr-actions button.gpt-sr-add");
		addButton.addEventListener("click",function(){
			var currentElement = event.target;
			currentElement.disabled = true;
			var liParentElement = currentElement.parentNode.parentNode;
			let liKeywords = liParentElement.getAttribute("data-key");
			noCompleteKeywords.push(liKeywords);
			updateKeywordsListItemElement(liKeywords,{'title':liKeywords,'status_text':statusMap[4],'status':4});
		});

		if(data.status == 0)
		{
			addButton.disabled = false;
		}
		else
		{
			addButton.disabled = true;
		}

		let listPanel = document.querySelector("#gpt-sr-popup ul");
		if(type == 1)
		{
			listPanel.appendChild(itemElement);
		}
		else if(type == 2)
		{
			listPanel.insertBefore(itemElement, listPanel.firstChild);
		}
		updateKewordsListStatistics();
	}

	/**
	 * 更新关键词列表元素
	 * @param key
	 * @param data
	 */
	function updateKeywordsListItemElement(key,data)
	{
		let itemElement = document.querySelector("#gpt-sr-popup ul li[data-key='" + key + "']");
		if(itemElement)
		{
			let statusElement = itemElement.querySelector("span.gpt-sr-status");
			statusElement.textContent = data.status_text;

			for (let scl in statusColorClassMap) {
				statusElement.classList.remove(statusColorClassMap[scl]);
			}

			statusElement.classList.add(statusColorClassMap[data.status]);

			let titleElement = itemElement.querySelector("span.gpt-sr-keyword");

			if(checkIsUrl(key) && data.hasOwnProperty("alias_title") && data['alias_title'] != "")
			{
				titleElement.querySelector('a').textContent = data.alias_title;
			}


			let addButton = itemElement.querySelector("div.gpt-sr-actions button.gpt-sr-add");
			if(data.status == 0)
			{
				addButton.setAttribute("disabled", false);
			}
			else
			{
				addButton.setAttribute("disabled", true);
			}
		}
		else
		{
			addKeywordListItemElement(data);
		}
		updateKewordsListStatistics();
	}

	function updateKewordsListStatistics()
	{
		let kwItems = document.querySelectorAll("#gpt-sr-popup ul li");
		document.querySelector("#gpt-sr-popup div.gpt-sr-content h2").textContent = "关键词列表(" + kwItems.length + ")";
	}

	function checkIsUrl(str)
	{
		return str.includes("http://") || str.includes("https://");
	}

	// 引入CSS文件
	function addStylesheet(url) {
		const linkElement = document.createElement("link");
		linkElement.rel = "stylesheet";
		linkElement.type = "text/css";
		linkElement.href = chrome.runtime.getURL(url);
		document.head.appendChild(linkElement);
	}
	// 在页面加载完成后插入弹层和引入CSS文件
	window.onload = function() {
		if(currentDomain.includes("chat.openai.com"))
		{
			initKeywrodsPopup();
			addStylesheet("css/gpt_keywords_list.css"); // 替换为您的CSS文件路径
		}
		chrome.storage.local.get('setting', function (data) {
			// 确保data.setting存在，避免TypeError
			if (!data || !data.setting) {
				data = { setting: {} };
			}
			collectLevel = (typeof data.setting.level !== 'undefined') ? parseInt(data.setting.level, 10) : 1;
			console.log("采集层级：" + collectLevel);
			chrome.runtime.sendMessage({"type":"init_setting","setting":data.setting}, function (response) {
				console.log(response.farewell)
			});
		});
	};


