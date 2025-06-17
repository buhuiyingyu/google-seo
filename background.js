// 处理内容脚本的注册
const activeTabs = new Set();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'contentScriptReady') {
    activeTabs.add(sender.tab.id);
  } else if (msg.action === 'downloadFile') {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError.message);
      } else {
        console.log('下载成功，ID:', downloadId);
      }
    });
  }
});

// 检查标签页是否准备好
chrome.runtime.onConnect.addListener(port => {
  port.onMessage.addListener(msg => {
    if (msg.type === 'checkReady') {
      port.postMessage({
        isReady: activeTabs.has(port.sender.tab.id)
      });
    }
  });
});

