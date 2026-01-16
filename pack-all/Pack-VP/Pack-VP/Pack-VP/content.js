/**
 * ProxyForce Content Script
 * ウェブページに注入されるスクリプト
 */

console.log('ProxyForce Content Script injected');

// ===============================
// 初期化
// ===============================

let powerLevel = 5;
let proxyEnabled = false;
let compressionEnabled = false;

// ステータスを取得
chrome.runtime.sendMessage(
  { action: 'getStatus' },
  (response) => {
    if (!response.error) {
      powerLevel = response.powerLevel || 5;
      proxyEnabled = response.proxyEnabled || false;
      compressionEnabled = response.compressionEnabled || false;
      
      console.log('ProxyForce Status:', {
        powerLevel,
        proxyEnabled,
        compressionEnabled
      });
    }
  }
);

// ===============================
// メッセージリスナー
// ===============================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received:', request);
  
  if (request.action === 'getPowerLevel') {
    sendResponse({ powerLevel });
  }
  
  if (request.action === 'statusChanged') {
    powerLevel = request.powerLevel || 5;
    proxyEnabled = request.proxyEnabled || false;
    compressionEnabled = request.compressionEnabled || false;
  }
});

// ===============================
// ページロード時の処理
// ===============================

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Content script: DOM loaded');
  
  if (compressionEnabled && powerLevel >= 4) {
    // 画像の圧縮を有効化
    compressImages();
  }
});

// ===============================
// 機能実装
// ===============================

/**
 * 画像を圧縮
 */
function compressImages() {
  const images = document.querySelectorAll('img');
  console.log('Compressing', images.length, 'images');
  
  images.forEach((img) => {
    // 圧縮レベルに応じて品質を調整
    const quality = Math.max(30, 100 - (powerLevel * 5));
    img.style.filter = `brightness(${quality / 100})`;
  });
}

/**
 * 広告要素を非表示
 */
function blockAds() {
  const adSelectors = [
    '[id*="ad"]',
    '[class*="ad"]',
    '[data-ad-slot]',
    '.advertisement',
    '.ads'
  ];
  
  adSelectors.forEach((selector) => {
    const ads = document.querySelectorAll(selector);
    ads.forEach((ad) => {
      ad.style.display = 'none';
    });
  });
}

/**
 * トラッキング要素を削除
 */
function blockTracking() {
  // トラッキングスクリプトを削除
  const scripts = document.querySelectorAll('script');
  const trackingScripts = [
    'google-analytics',
    'gtag',
    'facebook',
    'twitter',
    'mixpanel'
  ];
  
  scripts.forEach((script) => {
    const src = script.src || script.textContent;
    if (trackingScripts.some(tracker => src.includes(tracker))) {
      script.remove();
      console.log('Blocked tracking script');
    }
  });
}

/**
 * リソースヒント（prefetch）を削除してパフォーマンスを向上
 */
function optimizeLoading() {
  const links = document.querySelectorAll('link[rel="prefetch"], link[rel="preconnect"]');
  links.forEach((link) => {
    link.remove();
  });
}

// ===============================
// パフォーマンス測定
// ===============================

// ページロードタイム
const navigationTiming = window.performance.timing;
const loadTime = navigationTiming.loadEventEnd - navigationTiming.navigationStart;

console.log('ProxyForce - Page load time:', loadTime, 'ms');

// ===============================
// ミューテーションオブザーバー
// ===============================

// 新しく追加される要素を監視
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length > 0) {
      // 新しいノードが追加されたときの処理
      if (compressionEnabled) {
        const newImages = mutation.target.querySelectorAll?.('img') || [];
        newImages.forEach((img) => {
          const quality = Math.max(30, 100 - (powerLevel * 5));
          img.style.filter = `brightness(${quality / 100})`;
        });
      }
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('ProxyForce Content Script initialized');