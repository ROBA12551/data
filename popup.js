/**
 * ProxyForce Popup Script
 * 威力スライダー、プロキシ管理、フィーチャートグル
 * 複雑な状態管理・アニメーション制御を実装
 */

// ============================================================================
// グローバル状態管理
// ============================================================================

const STATE = {
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
  isActive: false,
  stats: {
    dataProcessed: 0,
    bandwidthSaved: 0,
    trackersBlocked: 0,
    adBlockCount: 0,
  },
  powerLevelDescriptions: {
    1: 'Level 1: 最軽量モード。ほぼフィルタリングなし。低消費電力。',
    2: 'Level 2: 軽量モード。最小限の圧縮とトラッキング防止。',
    3: 'Level 3: 標準軽量。20%圧縮、基本的なプライバシー保護。',
    4: 'Level 4: 標準。35%圧縮、中程度のプライバシー保護。',
    5: 'Level 5: バランス型。45%圧縮、安定したパフォーマンス。',
    6: 'Level 6: 強力。55%圧縮、強化されたプライバシー保護。',
    7: 'Level 7: 最強圧縮。70%圧縮、ほぼ全てのトラッキング遮断。',
    8: 'Level 8: 超強力。80%圧縮、広告ブロック有効化。',
    9: 'Level 9: エクストリーム。90%圧縮、全フィーチャー最大化。',
    10: 'Level 10: 究極モード。99%圧縮、無制限フィーチャー。警告：バッテリー消費大。',
  },
  compressionRates: [0, 10, 20, 30, 35, 45, 55, 70, 80, 90, 99],
  latencyTimes: [0, 30, 50, 80, 100, 120, 150, 200, 250, 300, 400],
  proxyServers: {
    default: {
      name: 'Default Proxy',
      host: '127.0.0.1',
      port: 8080,
      protocol: 'http',
      region: 'Local',
      speed: 'Fast',
      status: 'online',
    },
    secure: {
      name: 'Secure Proxy',
      host: 'proxy-sec.local',
      port: 8443,
      protocol: 'https',
      region: 'Encrypted',
      speed: 'Moderate',
      status: 'online',
    },
    performance: {
      name: 'Performance Proxy',
      host: 'proxy-fast.local',
      port: 9090,
      protocol: 'http',
      region: 'Optimized',
      speed: 'Ultra-Fast',
      status: 'optimizing',
    },
  },
};

// ============================================================================
// DOM要素キャッシング
// ============================================================================

const DOM = {
  powerSlider: document.getElementById('powerSlider'),
  powerValue: document.getElementById('powerValue'),
  powerBarFill: document.getElementById('powerBarFill'),
  powerDescription: document.getElementById('powerDescription'),
  compressionRate: document.getElementById('compressionRate'),
  latencyTime: document.getElementById('latencyTime'),
  proxyList: document.getElementById('proxyList'),
  compressionToggle: document.getElementById('compressionToggle'),
  cachingToggle: document.getElementById('cachingToggle'),
  adblockToggle: document.getElementById('adblockToggle'),
  trackingToggle: document.getElementById('trackingToggle'),
  encryptionToggle: document.getElementById('encryptionToggle'),
  cookiesToggle: document.getElementById('cookiesToggle'),
  activateBtn: document.getElementById('activateBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
};

// ============================================================================
// 初期化処理
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  attachEventListeners();
  loadStateFromStorage();
  startPeriodicSync();
});

/**
 * UIの初期化
 */
function initializeUI() {
  updatePowerUI();
  updateToggleUI();
  updateProxyUI();
  updateStatsUI();
  applyAnimations();
}

/**
 * イベントリスナー設定
 */
function attachEventListeners() {
  // パワースライダー
  DOM.powerSlider.addEventListener('input', handlePowerSliderChange);
  DOM.powerSlider.addEventListener('change', savePowerLevel);

  // プロキシ選択
  document.querySelectorAll('.proxy-item').forEach((item) => {
    item.addEventListener('click', handleProxySelect);
  });

  // フィーチャートグル
  document.querySelectorAll('.toggle-item').forEach((item) => {
    item.addEventListener('click', handleFeatureToggle);
  });

  // ボタン
  DOM.activateBtn.addEventListener('click', handleActivate);
  DOM.settingsBtn.addEventListener('click', handleSettings);

  // ウィンドウメッセージング（Background Scriptとの通信）
  chrome.runtime.onMessage.addListener(handleChromeMessage);
}

// ============================================================================
// イベントハンドラー
// ============================================================================

/**
 * パワースライダー変更時の処理
 */
function handlePowerSliderChange(event) {
  const newPower = parseInt(event.target.value, 10);
  STATE.powerLevel = newPower;
  updatePowerUI();
  sendPowerLevelToBackground(newPower);
}

/**
 * パワーレベル保存
 */
async function savePowerLevel() {
  await chrome.storage.local.set({
    proxyforce_powerLevel: STATE.powerLevel,
  });
  console.log(`Power Level saved: ${STATE.powerLevel}`);
}

/**
 * プロキシ選択ハンドラー
 */
function handleProxySelect(event) {
  const item = event.currentTarget;
  const proxyKey = item.dataset.proxy;

  // 既存のアクティブを削除
  document.querySelectorAll('.proxy-item').forEach((el) => {
    el.classList.remove('active');
  });

  // 新しいアクティブを追加
  item.classList.add('active');
  STATE.activeProxy = proxyKey;

  // Background Scriptに通知
  chrome.runtime.sendMessage({
    type: 'PROXY_CHANGED',
    proxy: proxyKey,
    proxyConfig: STATE.proxyServers[proxyKey],
  });

  // ストレージに保存
  chrome.storage.local.set({
    proxyforce_activeProxy: proxyKey,
  });

  // アニメーション
  addRippleEffect(event);
  showNotification(`Switched to ${STATE.proxyServers[proxyKey].name}`);
}

/**
 * フィーチャートグル処理
 */
function handleFeatureToggle(event) {
  const featureElement = event.currentTarget;
  const featureName = featureElement.dataset.feature;
  const toggleSwitch = featureElement.querySelector('.toggle-switch');

  // トグル状態を反転
  STATE.features[featureName] = !STATE.features[featureName];

  // UI更新
  toggleSwitch.classList.toggle('active');

  // Background Scriptに通知
  chrome.runtime.sendMessage({
    type: 'FEATURE_TOGGLED',
    feature: featureName,
    enabled: STATE.features[featureName],
  });

  // ストレージ保存
  chrome.storage.local.set({
    proxyforce_features: STATE.features,
  });

  // フィードバック
  addRippleEffect(event);
  const status = STATE.features[featureName] ? 'enabled' : 'disabled';
  showNotification(`${featureName.charAt(0).toUpperCase() + featureName.slice(1)} ${status}`);

  // パワーレベルの動的調整（特定フィーチャーの有効化時）
  adjustPowerLevelForFeatures();
}

/**
 * アクティベーション処理
 */
function handleActivate() {
  STATE.isActive = !STATE.isActive;
  const btn = DOM.activateBtn;

  if (STATE.isActive) {
    btn.textContent = 'DEACTIVATE';
    btn.classList.add('active');
    btn.style.opacity = '1';
  } else {
    btn.textContent = 'ACTIVATE';
    btn.classList.remove('active');
    btn.style.opacity = '0.7';
  }

  // Background Scriptに状態を通知
  chrome.runtime.sendMessage({
    type: 'ACTIVATION_TOGGLED',
    isActive: STATE.isActive,
  });

  // ストレージ保存
  chrome.storage.local.set({
    proxyforce_isActive: STATE.isActive,
  });

  // ビジュアルフィードバック
  const message = STATE.isActive ? 'ProxyForce ACTIVATED' : 'ProxyForce DEACTIVATED';
  showNotification(message, STATE.isActive ? 'success' : 'warning');

  // ボタンアニメーション
  btn.style.transform = 'scale(0.95)';
  setTimeout(() => {
    btn.style.transform = 'scale(1)';
  }, 100);
}

/**
 * 設定ボタン処理
 */
function handleSettings() {
  // 設定ページへのナビゲーション（将来の拡張）
  chrome.runtime.sendMessage({
    type: 'OPEN_SETTINGS',
  });

  showNotification('Settings page opening...', 'info');
}

/**
 * Background Scriptからのメッセージ受信
 */
function handleChromeMessage(request, sender, sendResponse) {
  console.log('Message from background:', request);

  switch (request.type) {
    case 'STATS_UPDATE':
      STATE.stats = request.stats;
      updateStatsUI();
      sendResponse({ status: 'stats-updated' });
      break;

    case 'POWER_LEVEL_APPLIED':
      console.log(`Power Level ${request.powerLevel} applied successfully`);
      sendResponse({ status: 'ack' });
      break;

    case 'PROXY_STATUS':
      updateProxyStatus(request.proxyKey, request.status);
      sendResponse({ status: 'ack' });
      break;

    default:
      console.warn('Unknown message type:', request.type);
      sendResponse({ status: 'unknown-type' });
  }
}

// ============================================================================
// UI更新関数
// ============================================================================

/**
 * パワーUI更新
 */
function updatePowerUI() {
  const power = STATE.powerLevel;

  // 値の更新
  DOM.powerValue.textContent = power;
  DOM.powerSlider.value = power;

  // バーの更新
  const percentage = (power / 10) * 100;
  DOM.powerBarFill.style.width = `${percentage}%`;

  // 説明の更新
  DOM.powerDescription.textContent = STATE.powerLevelDescriptions[power];

  // 統計情報の更新
  updateCompressionAndLatency(power);

  // アニメーション効果
  animatePowerValue();
}

/**
 * 圧縮率とレイテンシ更新
 */
function updateCompressionAndLatency(powerLevel) {
  const compressionRate = STATE.compressionRates[powerLevel];
  const latencyTime = STATE.latencyTimes[powerLevel];

  DOM.compressionRate.textContent = `${compressionRate}%`;
  DOM.latencyTime.textContent = `${latencyTime}ms`;

  // アニメーション
  animateStat(DOM.compressionRate);
  animateStat(DOM.latencyTime);
}

/**
 * トグルUI更新
 */
function updateToggleUI() {
  Object.entries(STATE.features).forEach(([feature, enabled]) => {
    const toggleSwitch = document.getElementById(`${feature}Toggle`);
    if (toggleSwitch) {
      toggleSwitch.classList.toggle('active', enabled);
    }
  });
}

/**
 * プロキシUI更新
 */
function updateProxyUI() {
  document.querySelectorAll('.proxy-item').forEach((item) => {
    const proxyKey = item.dataset.proxy;
    item.classList.toggle('active', proxyKey === STATE.activeProxy);
  });
}

/**
 * 統計情報UI更新
 */
function updateStatsUI() {
  // 統計が利用可能な場合、ここで更新可能
  console.log('Stats:', STATE.stats);
}

/**
 * プロキシステータス更新
 */
function updateProxyStatus(proxyKey, status) {
  const proxyItem = document.querySelector(`.proxy-item[data-proxy="${proxyKey}"]`);
  if (!proxyItem) return;

  const statusBadge = proxyItem.querySelector('.status-badge');
  if (statusBadge) {
    statusBadge.classList.toggle('warning', status === 'optimizing');
    statusBadge.classList.toggle('error', status === 'offline');
    statusBadge.classList.toggle('success', status === 'online');
    statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// ============================================================================
// アニメーション関数
// ============================================================================

/**
 * 一般的なアニメーション適用
 */
function applyAnimations() {
  const elements = document.querySelectorAll('[class*="fade"], [class*="slide"]');
  elements.forEach((el, index) => {
    el.style.animationDelay = `${index * 0.05}s`;
  });
}

/**
 * パワーバリュー値のアニメーション
 */
function animatePowerValue() {
  const element = DOM.powerValue;
  element.style.animation = 'none';
  setTimeout(() => {
    element.style.animation = 'pulse 0.5s ease-out';
  }, 10);
}

/**
 * 統計値のアニメーション
 */
function animateStat(element) {
  element.style.transform = 'scale(1.1)';
  setTimeout(() => {
    element.style.transform = 'scale(1)';
  }, 150);
}

/**
 * リップル効果（クリック時）
 */
function addRippleEffect(event) {
  const element = event.currentTarget;
  const ripple = document.createElement('span');
  ripple.style.position = 'absolute';
  ripple.style.borderRadius = '50%';
  ripple.style.background = 'rgba(255, 255, 255, 0.6)';
  ripple.style.pointerEvents = 'none';

  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.animation = 'ripple-animation 0.6s ease-out';

  element.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

/**
 * リップルアニメーション（CSSで定義）
 */
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple-animation {
    from {
      transform: scale(0);
      opacity: 1;
    }
    to {
      transform: scale(1);
      opacity: 0;
    }
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
`;
document.head.appendChild(style);

// ============================================================================
// 通知とフィードバック
// ============================================================================

/**
 * 通知表示（ボトムバナー方式）
 */
function showNotification(message, type = 'info') {
  // 既存の通知があれば削除
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #00d9ff 0%, #ff006e 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 8px 24px rgba(0, 217, 255, 0.4);
    animation: slideUpIn 0.3s ease-out;
  `;

  if (type === 'success') {
    notification.style.background = 'linear-gradient(135deg, #00ff88 0%, #00d9ff 100%)';
  } else if (type === 'warning') {
    notification.style.background = 'linear-gradient(135deg, #ffaa00 0%, #ff6600 100%)';
  } else if (type === 'error') {
    notification.style.background = 'linear-gradient(135deg, #ff3366 0%, #ff006e 100%)';
  }

  document.body.appendChild(notification);

  // 自動削除
  setTimeout(() => {
    notification.style.animation = 'slideDownOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================================================
// ストレージ管理
// ============================================================================

/**
 * ストレージから状態をロード
 */
async function loadStateFromStorage() {
  const result = await chrome.storage.local.get([
    'proxyforce_powerLevel',
    'proxyforce_activeProxy',
    'proxyforce_features',
    'proxyforce_isActive',
  ]);

  if (result.proxyforce_powerLevel !== undefined) {
    STATE.powerLevel = result.proxyforce_powerLevel;
    DOM.powerSlider.value = STATE.powerLevel;
  }

  if (result.proxyforce_activeProxy !== undefined) {
    STATE.activeProxy = result.proxyforce_activeProxy;
  }

  if (result.proxyforce_features !== undefined) {
    STATE.features = { ...STATE.features, ...result.proxyforce_features };
  }

  if (result.proxyforce_isActive !== undefined) {
    STATE.isActive = result.proxyforce_isActive;
    if (STATE.isActive) {
      DOM.activateBtn.textContent = 'DEACTIVATE';
      DOM.activateBtn.classList.add('active');
    }
  }

  updatePowerUI();
  updateToggleUI();
  updateProxyUI();
}

// ============================================================================
// Background Scriptとの通信
// ============================================================================

/**
 * パワーレベルをBackground Scriptに送信
 */
function sendPowerLevelToBackground(powerLevel) {
  chrome.runtime.sendMessage({
    type: 'POWER_LEVEL_CHANGED',
    powerLevel: powerLevel,
    compressionRate: STATE.compressionRates[powerLevel],
    latencyTime: STATE.latencyTimes[powerLevel],
  });
}

// ============================================================================
// 動的調整関数
// ============================================================================

/**
 * フィーチャー有効化時のパワーレベル動的調整
 */
function adjustPowerLevelForFeatures() {
  const enabledFeatures = Object.values(STATE.features).filter(Boolean).length;

  // フィーチャーが多く有効な場合、パワーレベルを上げる提案
  if (enabledFeatures >= 5 && STATE.powerLevel < 7) {
    // サジェスション（オプション）
    console.log('Suggestion: Consider increasing power level for better performance');
  }
}

// ============================================================================
// 定期同期
// ============================================================================

/**
 * 定期的にBackground Scriptと同期
 */
function startPeriodicSync() {
  // 5秒ごとにステータスをリクエスト
  setInterval(() => {
    chrome.runtime.sendMessage(
      {
        type: 'REQUEST_STATUS',
      },
      (response) => {
        if (response) {
          console.log('Status sync:', response);
        }
      }
    );
  }, 5000);
}

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * ログ出力（デバッグ用）
 */
function log(message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[ProxyForce ${timestamp}] ${message}`, data || '');
}

/**
 * 状態ダンプ（デバッグ用）
 */
function dumpState() {
  console.table(STATE);
  console.log('Features:', STATE.features);
  console.log('Active Proxy:', STATE.activeProxy);
}

// デバッグ用：グローバルスコープに露出
window.ProxyForceDebug = {
  getState: () => STATE,
  dumpState,
  sendMessage: (type, payload) => {
    chrome.runtime.sendMessage({ type, ...payload });
  },
};

log('Popup script loaded successfully');