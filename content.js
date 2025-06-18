chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSearch') {
      startBulkSearch(request.keywords, request.enableWebSearch)
        .then(result => sendResponse({ status: result }))
        .catch(error => sendResponse({ status: '错误: ' + error.message }));
      return true;
    }
  });
  
  async function startBulkSearch(keywords, enableWebSearch) {
    let currentIndex = 0;
    
    const elements = {
      get input() {
        return document.querySelector('div#prompt-textarea[contenteditable="true"]') || 
               document.querySelector('textarea[placeholder*="Message ChatGPT"]') ||
               document.querySelector('textarea[placeholder*="发送消息"]') ||
               document.querySelector('textarea[placeholder*="Send a message"]');
      },
      get sendButton() {
        return document.querySelector('button[aria-label="发送提示"]') || 
               document.querySelector('button[data-testid="send-button"]') ||
               document.querySelector('button[type="submit"]') ||
               document.querySelector('button[aria-label="Send message"]') ||
               document.querySelector('button[aria-label="发送消息"]') ||
               document.querySelector('button[aria-label="Send"]') ||
               document.querySelector('button[aria-label="发送"]');
      },
      get newChatButton() {
        return document.querySelector('a[data-testid="create-new-chat-button"]') ||
               document.querySelector('a[href="/"]') ||
               document.querySelector('a[aria-label="New chat"]') ||
               document.querySelector('a[aria-label="新对话"]');
      }
    };
  
    // 启用搜索网页功能
    async function enableWebSearch() {
      console.log('正在启用搜索网页功能...');
      
      // 1. 修改工具配置
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const [resource, config] = args;
        
        // 拦截工具配置请求
        if (resource.includes('/backend-api/tools') || resource.includes('/backend-api/conversation')) {
          const response = await originalFetch.apply(this, args);
          const clone = response.clone();
          
          try {
            const data = await clone.json();
            
            // 确保工具列表包含web工具
            if (data.tools && !data.tools.some(tool => tool.tool_name === 'web')) {
              data.tools.push({ tool_name: 'web' });
            }
            
            // 确保当前会话启用了web工具
            if (data.model && data.tools && !data.tools.includes('web')) {
              data.tools.push('web');
            }
            
            // 返回修改后的响应
            return new Response(JSON.stringify(data), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          } catch (e) {
            console.error('处理响应时出错:', e);
            return response;
          }
        }
        
        return originalFetch.apply(this, args);
      };

      // 2. 修改全局配置
      if (window.__NEXT_DATA__ && window.__NEXT_DATA__.props) {
        const props = window.__NEXT_DATA__.props;
        if (props.pageProps) {
          if (!props.pageProps.tools) {
            props.pageProps.tools = [];
          }
          if (!props.pageProps.tools.some(tool => tool.tool_name === 'web')) {
            props.pageProps.tools.push({ tool_name: 'web' });
          }
        }
      }

      // 3. 等待页面完全加载
      // await delay(2000);

      try {
        // 7. 验证搜索工具是否已启用
        console.log('验证搜索工具是否已启用...');
        const isWebSearchEnabled = await waitForElement(() => {
          const searchButton = document.querySelector('button[aria-label*="Web Search"]') || 
                             document.querySelector('button[aria-label*="搜索网页"]');
          return searchButton?.getAttribute('aria-pressed') === 'true';
        }, 2000);

        if (!isWebSearchEnabled) {
          console.log('搜索工具可能未成功启用，尝试其他方式...');
        }

      } catch (error) {
        console.error('启用搜索功能时出错:', error);
      }

      // 8. 触发工具重新加载
      const event = new CustomEvent('tools-updated');
      window.dispatchEvent(event);

      console.log('搜索网页功能已启用');
      return true;
    }
  
    // 创建新对话
    async function createNewChat() {
      console.log('创建新对话...');
      const newChatButton = await waitForElement(() => elements.newChatButton, 5000);
      if (!newChatButton) {
        throw new Error('找不到新对话按钮');
      }
      newChatButton.click();
      await delay(2000); // 等待新对话加载
    }

    // 处理单个关键词
    async function processKeyword(keyword) {
      try {
        console.log(`处理关键词: ${keyword}`);
        
        // 1. 确保输入框就绪
        const inputElement = await waitForElement(() => elements.input, 10000);
        if (!inputElement) {
          throw new Error('找不到输入框');
        }
        console.log('输入框已就绪');


        // 3. 输入关键词
        console.log('输入关键词...');
        await typeKeyword(inputElement, keyword);
        await delay(1000);

        // 4. 提交问题
        const sendButton = await waitForElement(() => elements.sendButton, 10000);
        if (sendButton){
          console.log('点击发送按钮...');
          sendButton.click();
        }

        // 5. 等待响应完成
        console.log('等待ChatGPT响应...');
        await delay(25000); // 固定等待30秒
        console.log('等待完成，准备保存结果...');

        // 6. 保存结果
        console.log('保存结果...');
        await saveResult(keyword);
        console.log('结果已保存');

        return true;
      } catch (error) {
        console.error(`处理关键词 "${keyword}" 时出错:`, error);
        return false;
      }
    }

    // 主处理循环
    async function processAllKeywords() {
      if (currentIndex >= keywords.length) {
        return '✅ 所有关键词搜索完成';
      }

      const keyword = keywords[currentIndex];
      currentIndex++;

      // 创建新对话
      await createNewChat();
      
      // 处理当前关键词
      const success = await processKeyword(keyword);
      
      if (!success) {
        return `⚠️ 处理 "${keyword}" 时出错`;
      }

      // 继续处理下一个关键词
      return processAllKeywords();
    }

    // 辅助函数
    async function typeKeyword(element, text) {
      element.focus();
      element.innerHTML = '';
      // 添加搜索网页的提示格式
      const searchPrompt = `Please use the search function to search the following content：${text}`;
      const textNode = document.createTextNode(searchPrompt);
      element.appendChild(textNode);
      ['input', 'change'].forEach(type => {
        element.dispatchEvent(new Event(type, { bubbles: true }));
      });
    }
  
    async function saveResult(keyword) {
      const timestamp = new Date();
      const year = timestamp.getFullYear();
      const month = String(timestamp.getMonth() + 1).padStart(2, '0'); 
      const day = String(timestamp.getDate()).padStart(2, '0');
      const hour = String(timestamp.getHours()).padStart(2, '0');
      const minute = String(timestamp.getMinutes()).padStart(2, '0');
      const second = String(timestamp.getSeconds()).padStart(2, '0');
      const _timestamp = `${year}${month}${day}${hour}${minute}${second}`
      const html = document.documentElement.outerHTML;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      chrome.runtime.sendMessage({
        action: 'downloadFile',
        url: url,
        filename: `${keyword}-${_timestamp}.html`
      });
    }
  
    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForElement(selectorFn, timeout) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const element = selectorFn();
        if (element) {
          return element;
        }
        await delay(200);
      }
      return null;
    }
  
    return processAllKeywords();
  }