/**
 * ProxyForce Popup Script
 * ポップアップUIのコントローラー
 */

// ===============================
// DOM Elements
// ===============================

const powerSlider = document.getElementById('powerSlider');
const powerLevel = document.getElementById('powerLevel');
const powerFill = document.getElementById('powerFill');

const proxyToggle = document.getElementById('proxyToggle');
const compressionToggle = document.getElementById('compressionToggle');
const adBlockToggle = document.getElementById('adBlockToggle');
const trackingToggle = document.getElementById('trackingToggle');

const proxyStatus = document.getElementById('proxyStatus');
const compressionStatus = document.getElementById('compressionStatus');
const adBlockStatus = document.getElementById('adBlockStatus');
const trackingStatus = document.getElementById('trackingStatus');

const adCount = document.getElementById('adCount');
const trackingCount = document.getElementById('trackingCount');
const errorMessage = document.getElementById('errorMessage');

// ===============================
// 初期化
// ===============================

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  loadStatus();
  setupEventListeners();
});

// ===============================
// ステータス読み込み
// ===============================

function loadStatus() {
  chrome.runtime.sendMessage(
    { action: 'getStatus' },
    (response) => {
      if (response.error) {
        showError(response.error);
        return;
      }

      // パワーレベル
      powerSlider.value = response.powerLevel || 5;
      updatePowerLevel(response.powerLevel || 5);

      // トグル状態
      updateToggle(proxyToggle, proxyStatus, response.proxyEnabled);
      updateToggle(compressionToggle, compressionStatus, response.compressionEnabled);
      updateToggle(adBlockToggle, adBlockStatus, response.adBlockingEnabled);
      updateToggle(trackingToggle, trackingStatus, response.trackingProtectionEnabled);

      // 統計情報を読み込む
      chrome.storage.local.get(['adCount', 'trackingCount'], (result) => {
        adCount.textContent = result.adCount || 0;
        trackingCount.textContent = result.trackingCount || 0;
      });
    }
  );
}

// ===============================
// イベントリスナーの設定
// ===============================

function setupEventListeners() {
  // パワーレベルスライダー
  powerSlider.addEventListener('input', (e) => {
    const newLevel = parseInt(e.target.value);
    updatePowerLevel(newLevel);
    
    chrome.runtime.sendMessage(
      { action: 'setPowerLevel', level: newLevel },
      (response) => {
        if (response.error) {
          showError(response.error);
        } else {
          console.log('Power level updated:', newLevel);
        }
      }
    );
  });

  // プロキシトグル
  proxyToggle.addEventListener('click', () => {
    chrome.runtime.sendMessage(
      { action: 'toggleProxy' },
      (response) => {
        if (response.error) {
          showError(response.error);
        } else {
          updateToggle(proxyToggle, proxyStatus, response.proxyEnabled);
        }
      }
    );
  });

  // 圧縮トグル
  compressionToggle.addEventListener('click', () => {
    chrome.runtime.sendMessage(
      { action: 'toggleCompression' },
      (response) => {
        if (response.error) {
          showError(response.error);
        } else {
          updateToggle(compressionToggle, compressionStatus, response.compressionEnabled);
        }
      }
    );
  });

  // 広告ブロッキング（デモ用、disabled）
  adBlockToggle.addEventListener('click', () => {
    chrome.storage.local.get('adBlockingEnabled', (result) => {
      const newState = !result.adBlockingEnabled;
      chrome.storage.local.set({ adBlockingEnabled: newState });
      updateToggle(adBlockToggle, adBlockStatus, newState);
    });
  });

  // トラッキング保護（デモ用、disabled）
  trackingToggle.addEventListener('click', () => {
    chrome.storage.local.get('trackingProtectionEnabled', (result) => {
      const newState = !result.trackingProtectionEnabled;
      chrome.storage.local.set({ trackingProtectionEnabled: newState });
      updateToggle(trackingToggle, trackingStatus, newState);
    });
  });
}

// ===============================
// ユーティリティ関数
// ===============================

function updatePowerLevel(level) {
  powerLevel.textContent = level;
  const percentage = (level / 10) * 100;
  powerFill.style.width = percentage + '%';
}

function updateToggle(toggleBtn, statusIndicator, isActive) {
  if (isActive) {
    toggleBtn.classList.add('active');
    statusIndicator.classList.add('active');
  } else {
    toggleBtn.classList.remove('active');
    statusIndicator.classList.remove('active');
  }
}

function showError(message) {
  errorMessage.textContent = '❌ ' + message;
  errorMessage.classList.add('show');
  
  setTimeout(() => {
    errorMessage.classList.remove('show');
  }, 3000);
}

// ===============================
// リアルタイム更新（オプション）
// ===============================

// メッセージリスナー（background.js からの通知）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Popup received message:', request);
  
  if (request.action === 'updateStats') {
    adCount.textContent = request.adCount || 0;
    trackingCount.textContent = request.trackingCount || 0;
  }
  
  if (request.action === 'statusChanged') {
    loadStatus();
  }
});

console.log('Popup script loaded and ready');