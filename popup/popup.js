document.getElementById('startSearch').addEventListener('click', async () => {
    const keywords = document.getElementById('keywords').value
      .split(',')
      .map(k => k.trim())
      .filter(k => k);
    
    if (keywords.length === 0) {
      updateStatus('请输入有效关键词');
      return;
    }
  
    const enableWebSearch = document.getElementById('enableWebSearch').checked;
    const waitTime = parseInt(document.getElementById('waitTime').value) * 1000;
  
    updateStatus('准备开始...');
    
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 先注入内容脚本
    await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
    });
    
    // 发送消息给内容脚本
    chrome.tabs.sendMessage(tab.id, {
      action: 'startSearch',
      keywords,
      enableWebSearch,
      waitTime
    }, response => {
      if (chrome.runtime.lastError) {
        updateStatus('错误: ' + chrome.runtime.lastError.message);
      } else if (response?.status) {
        updateStatus(response.status);
      }
    });
  });
  
  function updateStatus(message) {
    document.getElementById('status').textContent = message;
  }