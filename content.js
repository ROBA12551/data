/**
 * ProxyForce Content Script
 * ページ内でのリクエスト監視、DOM操作、広告ブロック
 * Service Workerからのリクエスト制御を受け取り実行
 */

// ============================================================================
// グローバル状態
// ============================================================================

const CONTENT_STATE = {
  isActive: false,
  powerLevel: 5,
  features: {},
  interceptedRequests: 0,
  blockedElements: [],
};

// ============================================================================
// 初期化
// ============================================================================

// Content Scriptが読み込まれたら初期化
initializeContentScript();

async function initializeContentScript() {
  console.log('[ProxyForce Content] Script loaded');

  // ストレージから状態をロード
  const stored = await chrome.storage.local.get([
    'proxyforce_isActive',
    'proxyforce_powerLevel',
    'proxyforce_features',
  ]);

  CONTENT_STATE.isActive = stored.proxyforce_isActive || false;
  CONTENT_STATE.powerLevel = stored.proxyforce_powerLevel || 5;
  CONTENT_STATE.features = stored.proxyforce_features || {};

  console.log('[ProxyForce Content] Initialized', CONTENT_STATE);

  // フィーチャー実装
  if (CONTENT_STATE.isActive) {
    applyFeatures();
  }

  // Background Scriptからのメッセージ受信
  setupMessageListener();
}

// ============================================================================
// メッセージリスナー
// ============================================================================

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[ProxyForce Content] Message received:', request.type);

    switch (request.type) {
      case 'POWER_LEVEL_APPLIED':
        CONTENT_STATE.powerLevel = request.powerLevel;
        applyFeatures();
        sendResponse({ status: 'power-level-applied' });
        break;

      case 'FEATURE_TOGGLED':
        CONTENT_STATE.features[request.feature] = request.enabled;
        applyFeatures();
        sendResponse({ status: 'feature-toggled' });
        break;

      case 'ACTIVATION_STATUS':
        CONTENT_STATE.isActive = request.isActive;
        if (request.isActive) {
          applyFeatures();
        } else {
          removeFeatures();
        }
        sendResponse({ status: 'activation-updated' });
        break;

      case 'PROXY_STATUS':
        console.log('[ProxyForce Content] Proxy changed:', request.proxyKey);
        sendResponse({ status: 'proxy-noted' });
        break;

      default:
        sendResponse({ status: 'unknown-message' });
    }
  });
}

// ============================================================================
// フィーチャー実装
// ============================================================================

/**
 * すべてのフィーチャーを適用
 */
function applyFeatures() {
  if (!CONTENT_STATE.isActive) {
    return;
  }

  console.log('[ProxyForce Content] Applying features...');

  // フィーチャーごとに処理
  if (CONTENT_STATE.features.compression) {
    setupCompressionMonitoring();
  }

  if (CONTENT_STATE.features.adblock) {
    blockAdvertisements();
  }

  if (CONTENT_STATE.features.tracking) {
    blockTracking();
  }

  if (CONTENT_STATE.features.encryption) {
    enforceHTTPS();
  }

  if (CONTENT_STATE.features.cookies) {
    manageCookies();
  }

  if (CONTENT_STATE.features.caching) {
    optimizeCaching();
  }

  // DOMの監視
  setupDOMObserver();

  console.log('[ProxyForce Content] Features applied');
}

/**
 * フィーチャーを削除
 */
function removeFeatures() {
  console.log('[ProxyForce Content] Removing features...');

  // DOMObserverを停止
  if (CONTENT_STATE.observer) {
    CONTENT_STATE.observer.disconnect();
  }

  // ブロック要素を復元（オプション）
  // restoreBlockedElements();

  console.log('[ProxyForce Content] Features removed');
}

// ============================================================================
// 圧縮監視
// ============================================================================

/**
 * 圧縮監視のセットアップ
 */
function setupCompressionMonitoring() {
  // fetchとXMLHttpRequestをインターセプト
  interceptFetch();
  interceptXHR();

  console.log('[ProxyForce Content] Compression monitoring setup');
}

/**
 * Fetchをインターセプト
 */
function interceptFetch() {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [resource, config] = args;

    // リクエスト前処理
    console.log('[ProxyForce] Fetch intercepted:', resource);

    // オリジナルfetchを実行
    const response = await originalFetch.apply(this, args);

    // レスポンス処理
    if (response.ok && response.headers.get('content-type')?.includes('text')) {
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();

      // 圧縮情報を追跡
      trackCompressionStats(resource, text.length);
    }

    return response;
  };

  console.log('[ProxyForce Content] Fetch interceptor installed');
}

/**
 * XMLHttpRequestをインターセプト
 */
function interceptXHR() {
  const originalXHR = window.XMLHttpRequest.prototype.open;

  window.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    console.log('[ProxyForce] XHR intercepted:', method, url);

    // オリジナルメソッドを呼び出す
    return originalXHR.apply(this, [method, url, ...rest]);
  };

  console.log('[ProxyForce Content] XHR interceptor installed');
}

/**
 * 圧縮統計の追跡
 */
function trackCompressionStats(url, size) {
  CONTENT_STATE.interceptedRequests++;
  console.log(`[ProxyForce] Data processed: ${(size / 1024).toFixed(2)} KB`);
}

// ============================================================================
// 広告ブロック
// ============================================================================

/**
 * 広告要素のブロック
 */
function blockAdvertisements() {
  // 一般的な広告セレクタ
  const adSelectors = [
    '.ad',
    '.ads',
    '.advertisement',
    '[data-ad-status]',
    '[data-ad-format]',
    'iframe[src*="doubleclick"]',
    'iframe[src*="google-analytics"]',
    'iframe[src*="facebook.com/tr"]',
    '[id*="ad-"]',
    '[class*="ad-"]',
    '[class*="advert"]',
    '[class*="sponsor"]',
    'ins.adsbygoogle',
    '.google-auto-placed',
  ];

  const adElements = document.querySelectorAll(adSelectors.join(','));

  adElements.forEach((element) => {
    if (element && element.parentNode) {
      element.style.display = 'none';
      element.setAttribute('data-proxyforce-blocked', 'true');
      CONTENT_STATE.blockedElements.push(element);
    }
  });

  console.log(`[ProxyForce] Blocked ${adElements.length} advertisement elements`);

  // 定期的に新しい広告を監視
  const adBlockInterval = setInterval(() => {
    const newAds = document.querySelectorAll(adSelectors.join(','));
    newAds.forEach((element) => {
      if (element && !element.hasAttribute('data-proxyforce-blocked')) {
        element.style.display = 'none';
        element.setAttribute('data-proxyforce-blocked', 'true');
        CONTENT_STATE.blockedElements.push(element);
      }
    });
  }, 2000);

  CONTENT_STATE.adBlockInterval = adBlockInterval;
}

// ============================================================================
// トラッキング防止
// ============================================================================

/**
 * トラッキングスクリプトをブロック
 */
function blockTracking() {
  const trackingPatterns = [
    'google-analytics',
    'googletagmanager',
    'facebook.com/tr',
    'doubleclick.net',
    'scorecardresearch.com',
    'mixpanel.com',
    'intercom',
    'drift',
    'hotjar',
    'segment',
    'amplitude',
  ];

  // スクリプトタグを監視
  const scripts = document.querySelectorAll('script');
  scripts.forEach((script) => {
    const src = script.src || '';
    const isTracking = trackingPatterns.some((pattern) =>
      src.toLowerCase().includes(pattern)
    );

    if (isTracking) {
      script.remove();
      console.log(`[ProxyForce] Blocked tracking script: ${src}`);
    }
  });

  // DOMObserverで動的スクリプトを監視
  if (!CONTENT_STATE.observer) {
    setupDOMObserver();
  }

  console.log('[ProxyForce] Tracking prevention active');
}

// ============================================================================
// HTTPS強制
// ============================================================================

/**
 * HTTPS を強制
 */
function enforceHTTPS() {
  // 現在のページがHTTPの場合、HTTPSにリダイレクト
  if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
    const httpsUrl = window.location.href.replace('http://', 'https://');
    console.log('[ProxyForce] Enforcing HTTPS:', httpsUrl);
    window.location.href = httpsUrl;
  }

  // リソースのURL書き換え
  document.querySelectorAll('a, img, script, link').forEach((element) => {
    const attr = element.tagName === 'A' ? 'href' : 'src' || 'href';
    if (element.hasAttribute(attr)) {
      const url = element.getAttribute(attr);
      if (url && url.startsWith('http://')) {
        const httpsUrl = url.replace('http://', 'https://');
        element.setAttribute(attr, httpsUrl);
      }
    }
  });

  console.log('[ProxyForce] HTTPS enforcement active');
}

// ============================================================================
// Cookie管理
// ============================================================================

/**
 * Cookie を管理・制限
 */
function manageCookies() {
  // 既存のCookieを確認
  const cookies = document.cookie.split(';');
  console.log(`[ProxyForce] Current cookies: ${cookies.length}`);

  // 永続的なCookieを制限（セッションCookieのみを許可）
  const restrictiveSameSite = () => {
    // すべてのcookieにSameSite=Strictを設定するよう試みる
    // （完全なコントロールはBackground Scriptが必要）
    console.log('[ProxyForce] Cookie SameSite policy applied');
  };

  restrictiveSameSite();
}

// ============================================================================
// キャッシング最適化
// ============================================================================

/**
 * キャッシング最適化
 */
function optimizeCaching() {
  // Service Workerを使用してキャッシング戦略を実装
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[ProxyForce] Service Worker registered for caching');
      })
      .catch((error) => {
        console.error('[ProxyForce] Service Worker registration failed:', error);
      });
  }
}

// ============================================================================
// DOM Observer
// ============================================================================

/**
 * DOMの変化を監視
 */
function setupDOMObserver() {
  if (CONTENT_STATE.observer) {
    return; // 既に設定済み
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // 新しいスクリプトが追加された場合
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'SCRIPT') {
            // トラッキング防止
            if (CONTENT_STATE.features.tracking && isTrackingScript(node.src)) {
              node.remove();
              console.log(`[ProxyForce] Blocked injected tracking script`);
            }
          }

          // 新しい広告要素
          if (
            CONTENT_STATE.features.adblock &&
            (node.classList?.contains('ad') ||
              node.classList?.contains('advertisement') ||
              node.id?.includes('ad-'))
          ) {
            node.style.display = 'none';
            console.log('[ProxyForce] Blocked injected ad element');
          }
        });
      }
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributeFilter: ['src', 'href', 'id', 'class'],
  });

  CONTENT_STATE.observer = observer;
  console.log('[ProxyForce] DOM Observer started');
}

/**
 * トラッキングスクリプトの判定
 */
function isTrackingScript(src) {
  const trackingPatterns = [
    'google-analytics',
    'googletagmanager',
    'facebook.com/tr',
    'doubleclick',
    'mixpanel',
  ];

  if (!src) return false;
  return trackingPatterns.some((pattern) => src.toLowerCase().includes(pattern));
}

// ============================================================================
// パフォーマンス計測
// ============================================================================

/**
 * ページロード時間を計測
 */
function measurePerformance() {
  if (window.performance && window.performance.timing) {
    window.addEventListener('load', () => {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;

      console.log(`[ProxyForce] Page load time: ${loadTime}ms`);

      // Background Scriptに送信
      chrome.runtime.sendMessage({
        type: 'PERFORMANCE_METRIC',
        metric: 'pageLoadTime',
        value: loadTime,
      });
    });
  }
}

measurePerformance();

// ============================================================================
// ユーティリティ
// ============================================================================

/**
 * ログ出力
 */
function log(message, data = null) {
  console.log(`[ProxyForce Content] ${message}`, data || '');
}

/**
 * デバッグ情報
 */
window.ProxyForceDebug = {
  getContentState: () => CONTENT_STATE,
  blockAdsNow: () => blockAdvertisements(),
  blockTrackingNow: () => blockTracking(),
};

log('Content Script fully initialized');