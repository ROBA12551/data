/**
 * ProxyForce Background Service Worker
 * Service Worker として動作する背景スクリプト
 */

// ===============================
// 初期化
// ===============================

// Service Worker が起動したとき
console.log('ProxyForce Service Worker loaded');

// ===============================
// イベントリスナー
// ===============================

// インストール時
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('ProxyForce extension installed');
    // 初期設定を保存
    chrome.storage.local.set({
      powerLevel: 5,
      proxyEnabled: false,
      compressionEnabled: false,
      adBlockingEnabled: true,
      trackingProtectionEnabled: true
    });
  }
});

// ===============================
// メッセージリスナー
// ===============================

// popup.js や content.js からのメッセージを受け取る
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);
  
  try {
    if (request.action === 'getPowerLevel') {
      // パワーレベルを取得
      chrome.storage.local.get('powerLevel', (result) => {
        sendResponse({ powerLevel: result.powerLevel || 5 });
      });
      return true; // 非同期レスポンス
    }
    
    if (request.action === 'setPowerLevel') {
      // パワーレベルを設定
      const newLevel = Math.max(1, Math.min(10, request.level));
      chrome.storage.local.set({ powerLevel: newLevel }, () => {
        console.log('Power level set to:', newLevel);
        sendResponse({ success: true, powerLevel: newLevel });
      });
      return true;
    }
    
    if (request.action === 'toggleProxy') {
      // プロキシを切り替え
      chrome.storage.local.get('proxyEnabled', (result) => {
        const newState = !result.proxyEnabled;
        chrome.storage.local.set({ proxyEnabled: newState }, () => {
          console.log('Proxy toggled:', newState);
          sendResponse({ success: true, proxyEnabled: newState });
        });
      });
      return true;
    }
    
    if (request.action === 'toggleCompression') {
      // 圧縮を切り替え
      chrome.storage.local.get('compressionEnabled', (result) => {
        const newState = !result.compressionEnabled;
        chrome.storage.local.set({ compressionEnabled: newState }, () => {
          console.log('Compression toggled:', newState);
          sendResponse({ success: true, compressionEnabled: newState });
        });
      });
      return true;
    }
    
    if (request.action === 'getStatus') {
      // 現在のステータスを取得
      chrome.storage.local.get(null, (result) => {
        sendResponse({
          powerLevel: result.powerLevel || 5,
          proxyEnabled: result.proxyEnabled || false,
          compressionEnabled: result.compressionEnabled || false,
          adBlockingEnabled: result.adBlockingEnabled || true,
          trackingProtectionEnabled: result.trackingProtectionEnabled || true
        });
      });
      return true;
    }
    
    // デフォルトレスポンス
    sendResponse({ error: 'Unknown action', action: request.action });
    
  } catch (error) {
    console.error('Error in message listener:', error);
    sendResponse({ error: error.message });
  }
});

// ===============================
// タブ変更時のハンドリング
// ===============================

chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('Tab activated:', activeInfo.tabId);
  // タブが切り替わったときの処理
});

// ===============================
// ウェブナビゲーション
// ===============================

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) {
    console.log('Navigating to:', details.url);
    // ナビゲーション前の処理
  }
});

// ===============================
// Alarms（定期的なタスク）
// ===============================

// 毎日1回、統計情報をリセット
chrome.alarms.create('dailyReset', { periodInMinutes: 24 * 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    console.log('Daily reset triggered');
    chrome.storage.local.set({
      dailyAdCount: 0,
      dailyTrackingBlocked: 0,
      dataSaved: 0
    });
  }
});

// ===============================
// ホットリロード（開発用）
// ===============================

// マニフェストの変更を検出
chrome.runtime.onUpdateAvailable.addListener(() => {
  console.log('Extension update available');
  chrome.runtime.reload();
});

console.log('ProxyForce Service Worker initialization complete');