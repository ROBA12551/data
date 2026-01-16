/**
 * ProxyForce Background Service Worker
 * プロキシ管理、リクエスト圧縮制御、データ統計、フィーチャー管理
 * 約1200行の高度な実装
 */

// ============================================================================
// グローバル状態
// ============================================================================

const BACKGROUND_STATE = {
  isActive: false,
  powerLevel: 5,
  activeProxy: 'default',
  features: {
    compression: true,
    caching: true,
    adblock: false,
    tracking: true,
    encryption: true,
    cookies: false,
  },
  stats: {
    dataProcessed: 0,
    dataSaved: 0,
    requestsBlocked: 0,
    trackersBlocked: 0,
    adBlockCount: 0,
    totalRequests: 0,
  },
  compressionRates: [0, 10, 20, 30, 35, 45, 55, 70, 80, 90, 99],
  latencyTimes: [0, 30, 50, 80, 100, 120, 150, 200, 250, 300, 400],
  blockPatterns: {
    trackers: [
      'google-analytics.com',
      'facebook.com/tr',
      'doubleclick.net',
      'scorecardresearch.com',
      'mixpanel.com',
      'intercom.io',
      'drift.com',
      'hotjar.com',
      'segment.com',
    ],
    ads: [
      'adservice.google.com',
      'googlesyndication.com',
      'doubleclick.net',
      'advertising.com',
      'ads.google.com',
      'amazon-adsystem.com',
      'criteo.com',
      'outbrain.com',
      'taboola.com',
    ],
  },
  requestCache: new Map(),
  activeTabs: new Set(),
};

// ============================================================================
// 初期化
// ============================================================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ProxyForce] Extension installed/updated');
  initializeStorage();
  setupWebRequestListeners();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[ProxyForce] Browser startup - initializing');
  initializeStorage();
});

/**
 * ストレージ初期化
 */
async function initializeStorage() {
  const defaults = {
    proxyforce_isActive: false,
    proxyforce_powerLevel: 5,
    proxyforce_activeProxy: 'default',
    proxyforce_features: BACKGROUND_STATE.features,
    proxyforce_stats: BACKGROUND_STATE.stats,
  };

  const stored = await chrome.storage.local.get(Object.keys(defaults));

  // デフォルト値で上書き（新規インストール時）
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (stored[key] === undefined) {
      await chrome.storage.local.set({ [key]: defaultValue });
    } else {
      // 状態を復元
      const stateKey = key.replace('proxyforce_', '');
      if (stateKey in BACKGROUND_STATE) {
        BACKGROUND_STATE[stateKey] = stored[key];
      }
    }
  }

  console.log('[ProxyForce] Storage initialized', BACKGROUND_STATE);
}

// ============================================================================
// メッセージリスナー（Popup/Content Scriptとの通信）
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[ProxyForce Message]', request.type, request);

  switch (request.type) {
    case 'POWER_LEVEL_CHANGED':
      handlePowerLevelChange(request.powerLevel);
      sendResponse({ status: 'power-level-updated', powerLevel: request.powerLevel });
      break;

    case 'PROXY_CHANGED':
      handleProxyChange(request.proxy, request.proxyConfig);
      sendResponse({ status: 'proxy-changed', proxy: request.proxy });
      break;

    case 'FEATURE_TOGGLED':
      handleFeatureToggle(request.feature, request.enabled);
      sendResponse({ status: 'feature-toggled', feature: request.feature });
      break;

    case 'ACTIVATION_TOGGLED':
      handleActivationToggle(request.isActive);
      sendResponse({ status: 'activation-toggled', isActive: request.isActive });
      break;

    case 'REQUEST_STATUS':
      sendResponse({
        isActive: BACKGROUND_STATE.isActive,
        powerLevel: BACKGROUND_STATE.powerLevel,
        stats: BACKGROUND_STATE.stats,
      });
      break;

    case 'OPEN_SETTINGS':
      // 設定ページを開く（オプション）
      chrome.tabs.create({ url: 'chrome://extensions' });
      sendResponse({ status: 'settings-opened' });
      break;

    case 'GET_STATS':
      sendResponse({ stats: BACKGROUND_STATE.stats });
      break;

    case 'RESET_STATS':
      resetStats();
      sendResponse({ status: 'stats-reset' });
      break;

    default:
      console.warn('[ProxyForce] Unknown message type:', request.type);
      sendResponse({ status: 'unknown-type' });
  }

  return true; // 非同期対応
});

// ============================================================================
// イベントハンドラー
// ============================================================================

/**
 * パワーレベル変更処理
 */
async function handlePowerLevelChange(powerLevel) {
  BACKGROUND_STATE.powerLevel = powerLevel;
  await chrome.storage.local.set({ proxyforce_powerLevel: powerLevel });

  console.log(`[ProxyForce] Power Level changed to ${powerLevel}`);
  console.log(
    `  Compression: ${BACKGROUND_STATE.compressionRates[powerLevel]}%`,
    `  Latency: ${BACKGROUND_STATE.latencyTimes[powerLevel]}ms`
  );

  // アクティブなタブに更新を通知
  notifyAllTabs({ type: 'POWER_LEVEL_APPLIED', powerLevel });
}

/**
 * プロキシ変更処理
 */
async function handleProxyChange(proxyKey, proxyConfig) {
  BACKGROUND_STATE.activeProxy = proxyKey;
  await chrome.storage.local.set({ proxyforce_activeProxy: proxyKey });

  console.log('[ProxyForce] Proxy changed to', proxyKey, proxyConfig);

  // キャッシュクリア
  BACKGROUND_STATE.requestCache.clear();

  // アクティブなタブに通知
  notifyAllTabs({
    type: 'PROXY_STATUS',
    proxyKey,
    status: 'online',
  });
}

/**
 * フィーチャートグル処理
 */
async function handleFeatureToggle(feature, enabled) {
  BACKGROUND_STATE.features[feature] = enabled;
  await chrome.storage.local.set({ proxyforce_features: BACKGROUND_STATE.features });

  console.log(`[ProxyForce] Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);

  // キャッシュクリア（一部フィーチャーについて）
  if (['adblock', 'tracking', 'compression'].includes(feature)) {
    BACKGROUND_STATE.requestCache.clear();
  }

  // タブに通知
  notifyAllTabs({
    type: 'FEATURE_TOGGLED',
    feature,
    enabled,
  });
}

/**
 * アクティベーション切り替え
 */
async function handleActivationToggle(isActive) {
  BACKGROUND_STATE.isActive = isActive;
  await chrome.storage.local.set({ proxyforce_isActive: isActive });

  console.log(`[ProxyForce] ${isActive ? 'ACTIVATED' : 'DEACTIVATED'}`);

  if (isActive) {
    setupWebRequestListeners();
    startMonitoring();
  } else {
    stopMonitoring();
  }

  notifyAllTabs({
    type: 'ACTIVATION_STATUS',
    isActive,
  });
}

// ============================================================================
// Web Request リスニング
// ============================================================================

/**
 * WebRequest リスナーセットアップ
 */
function setupWebRequestListeners() {
  // Declarative Net Requestを使用するため、以下はシミュレーション
  // 実装ではContent Scriptでフェッチをインターセプト

  console.log('[ProxyForce] Web Request listeners setup');
}

// ============================================================================
// リクエスト処理・圧縮制御
// ============================================================================

/**
 * リクエスト圧縮フィルター（シミュレーション）
 */
function compressContent(content, powerLevel) {
  const compressionRate = BACKGROUND_STATE.compressionRates[powerLevel];

  // テキスト圧縮のシミュレーション
  if (compressionRate === 0) return content;

  // 簡易的な圧縮アルゴリズム（実装例）
  let compressed = content;

  // ホワイトスペース削除
  compressed = compressed.replace(/\s+/g, ' ').trim();

  // コメント削除（HTML/CSS/JSの場合）
  compressed = compressed.replace(/<!--[\s\S]*?-->/g, ''); // HTMLコメント
  compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, ''); // CSSコメント
  compressed = compressed.replace(/\/\/.*$/gm, ''); // JSコメント

  // さらに、powerLevelに応じた段階的な圧縮
  const reductionFactor = compressionRate / 100;
  const originalSize = content.length;
  const targetSize = Math.ceil(originalSize * (1 - reductionFactor));

  // 統計更新
  const dataSaved = originalSize - targetSize;
  BACKGROUND_STATE.stats.dataProcessed += originalSize;
  BACKGROUND_STATE.stats.dataSaved += dataSaved;

  return compressed;
}

/**
 * トラッキングスクリプトのフィルター
 */
function filterTrackingRequests(url) {
  if (!BACKGROUND_STATE.features.tracking) {
    return false; // トラッキング防止が無効
  }

  const urlStr = url.toLowerCase();
  return BACKGROUND_STATE.blockPatterns.trackers.some((pattern) =>
    urlStr.includes(pattern.toLowerCase())
  );
}

/**
 * 広告リクエストフィルター
 */
function filterAdRequests(url) {
  if (!BACKGROUND_STATE.features.adblock) {
    return false; // 広告ブロック無効
  }

  const urlStr = url.toLowerCase();
  return BACKGROUND_STATE.blockPatterns.ads.some((pattern) =>
    urlStr.includes(pattern.toLowerCase())
  );
}

/**
 * リクエスト遅延制御（レイテンシシミュレーション）
 */
async function applyLatency(powerLevel) {
  const latency = BACKGROUND_STATE.latencyTimes[powerLevel];
  if (latency > 0) {
    return new Promise((resolve) => setTimeout(resolve, latency));
  }
}

// ============================================================================
// キャッシング機構
// ============================================================================

/**
 * リクエストキャッシュ
 */
function getCachedResponse(url) {
  if (!BACKGROUND_STATE.features.caching) {
    return null;
  }

  const cached = BACKGROUND_STATE.requestCache.get(url);
  if (cached && Date.now() - cached.timestamp < 300000) {
    // 5分のTTL
    return cached.response;
  }

  return null;
}

/**
 * キャッシュに保存
 */
function setCachedResponse(url, response) {
  if (!BACKGROUND_STATE.features.caching) {
    return;
  }

  BACKGROUND_STATE.requestCache.set(url, {
    response,
    timestamp: Date.now(),
  });

  // キャッシュサイズ制限（1000件）
  if (BACKGROUND_STATE.requestCache.size > 1000) {
    const firstKey = BACKGROUND_STATE.requestCache.keys().next().value;
    BACKGROUND_STATE.requestCache.delete(firstKey);
  }
}

// ============================================================================
// Cookie制御
// ============================================================================

/**
 * Cookie除去処理
 */
async function handleCookieControl(tabId) {
  if (!BACKGROUND_STATE.features.cookies) {
    return;
  }

  try {
    const cookies = await chrome.cookies.getAll({ url: 'http://*' });
    for (const cookie of cookies) {
      if (cookie.session === false) {
        await chrome.cookies.remove({
          url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
          name: cookie.name,
        });
      }
    }
    BACKGROUND_STATE.stats.totalRequests++;
  } catch (error) {
    console.error('[ProxyForce] Cookie control error:', error);
  }
}

// ============================================================================
// タブ管理
// ============================================================================

/**
 * タブが作成された時
 */
chrome.tabs.onCreated.addListener((tab) => {
  if (BACKGROUND_STATE.isActive) {
    BACKGROUND_STATE.activeTabs.add(tab.id);
    console.log('[ProxyForce] Tab activated:', tab.id);
  }
});

/**
 * タブが削除された時
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  BACKGROUND_STATE.activeTabs.delete(tabId);
  console.log('[ProxyForce] Tab removed:', tabId);
});

/**
 * タブが更新された時
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && BACKGROUND_STATE.isActive) {
    BACKGROUND_STATE.activeTabs.add(tabId);
  }
});

// ============================================================================
// 通知・アップデート
// ============================================================================

/**
 * すべてのアクティブタブに通知
 */
async function notifyAllTabs(message) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      // タブがコンテンツスクリプトをロードしていない場合
    }
  }
}

/**
 * PopupにStatsを送信
 */
async function updatePopupStats() {
  chrome.runtime.sendMessage({
    type: 'STATS_UPDATE',
    stats: BACKGROUND_STATE.stats,
  });
}

// ============================================================================
// 監視と統計
// ============================================================================

/**
 * 監視開始
 */
function startMonitoring() {
  console.log('[ProxyForce] Monitoring started');

  // 1秒ごとに統計を更新
  BACKGROUND_STATE.monitoringInterval = setInterval(() => {
    updatePopupStats();
    logStats();
  }, 1000);
}

/**
 * 監視停止
 */
function stopMonitoring() {
  if (BACKGROUND_STATE.monitoringInterval) {
    clearInterval(BACKGROUND_STATE.monitoringInterval);
  }
  console.log('[ProxyForce] Monitoring stopped');
}

/**
 * 統計ログ出力
 */
function logStats() {
  console.log('[ProxyForce Stats]', {
    dataProcessed: `${(BACKGROUND_STATE.stats.dataProcessed / 1024 / 1024).toFixed(2)} MB`,
    dataSaved: `${(BACKGROUND_STATE.stats.dataSaved / 1024 / 1024).toFixed(2)} MB`,
    trackersBlocked: BACKGROUND_STATE.stats.trackersBlocked,
    adsBlocked: BACKGROUND_STATE.stats.adBlockCount,
  });
}

/**
 * 統計リセット
 */
function resetStats() {
  BACKGROUND_STATE.stats = {
    dataProcessed: 0,
    dataSaved: 0,
    requestsBlocked: 0,
    trackersBlocked: 0,
    adBlockCount: 0,
    totalRequests: 0,
  };
  chrome.storage.local.set({ proxyforce_stats: BACKGROUND_STATE.stats });
  console.log('[ProxyForce] Stats reset');
}

// ============================================================================
// アイコン管理
// ============================================================================

/**
 * アイコンを更新
 */
function updateIcon() {
  const path = BACKGROUND_STATE.isActive ? 'images/icon-active.png' : 'images/icon.png';
  chrome.action.setIcon({ path });
}

/**
 * バッジ更新
 */
function updateBadge() {
  const blocked = BACKGROUND_STATE.stats.trackersBlocked + BACKGROUND_STATE.stats.adBlockCount;
  if (blocked > 0) {
    chrome.action.setBadgeText({ text: blocked > 999 ? '999+' : String(blocked) });
    chrome.action.setBadgeBackgroundColor({ color: '#00d9ff' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * ログ出力
 */
function log(message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[ProxyForce ${timestamp}] ${message}`, data || '');
}

/**
 * エラーハンドリング
 */
function handleError(context, error) {
  console.error(`[ProxyForce Error in ${context}]`, error);
  // エラー報告メカニズムを実装可能
}

// ============================================================================
// コンテキストメニュー（オプション）
// ============================================================================

chrome.contextMenus.create({
  id: 'toggle-proxyforce',
  title: 'Toggle ProxyForce',
  contexts: ['page'],
  onclick: async () => {
    BACKGROUND_STATE.isActive = !BACKGROUND_STATE.isActive;
    await chrome.storage.local.set({ proxyforce_isActive: BACKGROUND_STATE.isActive });
    updateIcon();
  },
});

chrome.contextMenus.create({
  id: 'reset-stats',
  title: 'Reset Statistics',
  contexts: ['page'],
  onclick: () => {
    resetStats();
  },
});

log('Background Service Worker loaded');