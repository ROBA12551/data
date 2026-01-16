/**
 * Netlify Functions for ProxyForce Backend
 * パス: /functions/
 * 
 * エンドポイント一覧：
 * - GET /api/proxy-config/:proxyKey
 * - POST /api/proxy-config
 * - GET /api/stats
 * - POST /api/stats
 * - GET /api/blocklists
 * - POST /api/power-level
 */

// ============================================================================
// shared/utils.js - ユーティリティ
// ============================================================================

const UTILS = {
  /**
   * CORS対応のレスポンスヘッダー
   */
  getCorsHeaders: () => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Content-Type': 'application/json',
  }),

  /**
   * JSON レスポンス
   */
  response: (statusCode, body) => ({
    statusCode,
    headers: UTILS.getCorsHeaders(),
    body: JSON.stringify(body),
  }),

  /**
   * エラーレスポンス
   */
  error: (statusCode, message) => ({
    statusCode,
    headers: UTILS.getCorsHeaders(),
    body: JSON.stringify({
      error: message,
      timestamp: new Date().toISOString(),
    }),
  }),

  /**
   * ジオロケーションを取得（請求用）
   */
  getGeolocation: (headers) => {
    return {
      country: headers['cloudflare-ipcountry'] || 'Unknown',
      clientIp: headers['client-ip'] || 'Unknown',
      userAgent: headers['user-agent'] || 'Unknown',
    };
  },
};

// ============================================================================
// functions/api/proxy-config.js
// ============================================================================

exports.proxyConfig = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return UTILS.response(200, { message: 'OK' });
  }

  if (event.httpMethod === 'GET') {
    const { proxyKey } = event.queryStringParameters || {};

    if (!proxyKey) {
      return UTILS.error(400, 'Missing proxyKey parameter');
    }

    // プロキシ設定データベース（シミュレーション）
    const proxyConfigs = {
      default: {
        name: 'Default Proxy',
        host: '127.0.0.1',
        port: 8080,
        protocol: 'http',
        region: 'Local',
        speed: 'Fast',
        latency: 30,
        uptime: 99.9,
        features: ['compression', 'caching', 'encryption'],
      },
      secure: {
        name: 'Secure Proxy',
        host: 'proxy-secure.proxyforce.io',
        port: 8443,
        protocol: 'https',
        region: 'EU',
        speed: 'Moderate',
        latency: 80,
        uptime: 99.95,
        features: ['compression', 'encryption', 'tracking-block'],
      },
      performance: {
        name: 'Performance Proxy',
        host: 'proxy-fast.proxyforce.io',
        port: 9090,
        protocol: 'http',
        region: 'JP',
        speed: 'Ultra-Fast',
        latency: 50,
        uptime: 99.85,
        features: ['compression', 'caching', 'ad-block'],
      },
      premium: {
        name: 'Premium Proxy',
        host: 'proxy-premium.proxyforce.io',
        port: 8443,
        protocol: 'https',
        region: 'Global',
        speed: 'Ultra-Fast',
        latency: 40,
        uptime: 99.99,
        features: ['compression', 'caching', 'encryption', 'tracking-block', 'ad-block'],
      },
    };

    const config = proxyConfigs[proxyKey];

    if (!config) {
      return UTILS.error(404, `Proxy configuration not found: ${proxyKey}`);
    }

    return UTILS.response(200, {
      success: true,
      proxyKey,
      config,
      timestamp: new Date().toISOString(),
    });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return UTILS.error(400, 'Invalid JSON in request body');
    }

    const { proxyName, host, port, protocol } = body;

    // 新しいプロキシ設定を保存（データベースに）
    if (!proxyName || !host || !port) {
      return UTILS.error(400, 'Missing required fields: proxyName, host, port');
    }

    // 検証
    if (!/^[a-z0-9-]+$/.test(proxyName.toLowerCase())) {
      return UTILS.error(400, 'Invalid proxy name format');
    }

    if (port < 1 || port > 65535) {
      return UTILS.error(400, 'Port must be between 1 and 65535');
    }

    // 保存（実装例：Netlify Datastore またはサードパーティDB）
    console.log('New proxy config:', { proxyName, host, port, protocol });

    return UTILS.response(201, {
      success: true,
      message: 'Proxy configuration created',
      proxyName,
      config: {
        host,
        port,
        protocol: protocol || 'http',
        createdAt: new Date().toISOString(),
      },
    });
  }

  return UTILS.error(405, 'Method not allowed');
};

// ============================================================================
// functions/api/stats.js
// ============================================================================

exports.stats = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return UTILS.response(200, { message: 'OK' });
  }

  if (event.httpMethod === 'GET') {
    // 統計情報を取得
    const stats = {
      totalUsers: 15234,
      totalDataProcessed: 524288000, // bytes
      totalDataSaved: 104857600, // bytes
      totalTrackersBlocked: 2456789,
      totalAdsBlocked: 1234567,
      averageCompressionRate: 45,
      networkStatus: {
        totalServers: 4,
        activeServers: 4,
        avgLatency: 65,
        avgUptime: 99.92,
      },
      topCountries: [
        { country: 'JP', users: 4500, dataSaved: 25165824 },
        { country: 'US', users: 3200, dataSaved: 20971520 },
        { country: 'GB', users: 2100, dataSaved: 15728640 },
        { country: 'DE', users: 1800, dataSaved: 13631488 },
        { country: 'FR', users: 1600, dataSaved: 12582912 },
      ],
      lastUpdated: new Date().toISOString(),
    };

    return UTILS.response(200, {
      success: true,
      stats,
    });
  }

  if (event.httpMethod === 'POST') {
    // ユーザーの統計を送信
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return UTILS.error(400, 'Invalid JSON');
    }

    const { dataProcessed, dataSaved, trackersBlocked, adsBlocked } = body;

    // 統計をデータベースに保存
    console.log('Stats received:', { dataProcessed, dataSaved, trackersBlocked, adsBlocked });

    return UTILS.response(200, {
      success: true,
      message: 'Statistics recorded',
      recorded: {
        dataProcessed,
        dataSaved,
        trackersBlocked,
        adsBlocked,
      },
    });
  }

  return UTILS.error(405, 'Method not allowed');
};

// ============================================================================
// functions/api/blocklists.js
// ============================================================================

exports.blocklists = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return UTILS.response(200, { message: 'OK' });
  }

  if (event.httpMethod === 'GET') {
    const { type } = event.queryStringParameters || {};

    // ブロックリスト（トラッキング・広告）
    const blockLists = {
      trackers: {
        name: 'Tracker Blocking List',
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        count: 2400,
        patterns: [
          'google-analytics.com',
          'facebook.com/tr',
          'doubleclick.net',
          'scorecardresearch.com',
          'mixpanel.com',
          'intercom.io',
          'drift.com',
          'hotjar.com',
          'segment.com',
          'amplitude.com',
          'heap.io',
          'fullstory.com',
          'pendo.io',
          'mouseflow.com',
          'smartlook.com',
          'userreplay.com',
          'sessioncam.com',
          'crazy-egg.com',
          'kissmetrics.com',
          'newrelic.com',
          'datadog.com',
          'appsignal.com',
          'sentry.io',
          'rollbar.com',
          'bugsnag.com',
          'errorception.com',
          'crashlytics.com',
          'fabric.io',
          'firebase.google.com',
        ],
      },
      ads: {
        name: 'Ad Blocking List',
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        count: 3200,
        patterns: [
          'adservice.google.com',
          'googlesyndication.com',
          'doubleclick.net',
          'advertising.com',
          'ads.google.com',
          'amazon-adsystem.com',
          'criteo.com',
          'outbrain.com',
          'taboola.com',
          'adnxs.com',
          'appnexus.com',
          'pubmatic.com',
          'openx.com',
          'rubiconproject.com',
          'spotxchange.com',
          'indexexchange.com',
          'contextweb.com',
          'pulsepoint.com',
          'sonobi.com',
          'districtm.io',
          'brightroll.com',
          'aol.com',
          'oath.com',
          'verizonmedia.com',
          'adcolony.com',
          'admob.google.com',
          'google.com/admob',
        ],
      },
      malware: {
        name: 'Malware & Phishing Blocking List',
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        count: 1500,
        patterns: [
          'malicious-domain-1.com',
          'phishing-site.net',
          'fake-bank.io',
          'ransomware-dropper.ru',
          'botnet-c2.com',
        ],
      },
    };

    if (type && blockLists[type]) {
      return UTILS.response(200, {
        success: true,
        blockList: blockLists[type],
      });
    }

    if (!type) {
      return UTILS.response(200, {
        success: true,
        blockLists: Object.keys(blockLists),
        count: Object.keys(blockLists).length,
      });
    }

    return UTILS.error(404, `Block list not found: ${type}`);
  }

  return UTILS.error(405, 'Method not allowed');
};

// ============================================================================
// functions/api/power-level.js
// ============================================================================

exports.powerLevel = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return UTILS.response(200, { message: 'OK' });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return UTILS.error(400, 'Invalid JSON');
    }

    const { powerLevel, userId } = body;

    if (!powerLevel || powerLevel < 1 || powerLevel > 10) {
      return UTILS.error(400, 'Power level must be between 1 and 10');
    }

    // パワーレベルの設定を保存
    const powerLevelConfig = {
      1: {
        name: 'Minimal',
        compressionRate: 10,
        latency: 30,
        features: ['basic-caching'],
        description: 'Lightweight mode. Minimal compression.',
      },
      2: {
        name: 'Light',
        compressionRate: 20,
        latency: 50,
        features: ['compression', 'basic-tracking-block'],
        description: 'Light mode. Basic compression and privacy protection.',
      },
      3: {
        name: 'Standard Light',
        compressionRate: 30,
        latency: 80,
        features: ['compression', 'caching', 'tracking-block'],
        description: 'Standard light. 30% compression, moderate privacy.',
      },
      4: {
        name: 'Standard',
        compressionRate: 35,
        latency: 100,
        features: ['compression', 'caching', 'tracking-block', 'encryption'],
        description: 'Standard mode. 35% compression, good privacy.',
      },
      5: {
        name: 'Balanced',
        compressionRate: 45,
        latency: 120,
        features: ['compression', 'caching', 'tracking-block', 'encryption'],
        description: 'Balanced mode. 45% compression, optimal performance.',
      },
      6: {
        name: 'Enhanced',
        compressionRate: 55,
        latency: 150,
        features: [
          'compression',
          'caching',
          'tracking-block',
          'encryption',
          'cookie-control',
        ],
        description: 'Enhanced mode. 55% compression, strong privacy.',
      },
      7: {
        name: 'Strong',
        compressionRate: 70,
        latency: 200,
        features: [
          'compression',
          'caching',
          'tracking-block',
          'encryption',
          'cookie-control',
          'ad-block',
        ],
        description: 'Strong mode. 70% compression, ads blocked.',
      },
      8: {
        name: 'Very Strong',
        compressionRate: 80,
        latency: 250,
        features: [
          'compression',
          'caching',
          'tracking-block',
          'encryption',
          'cookie-control',
          'ad-block',
          'javascript-control',
        ],
        description: 'Very strong. 80% compression, most features enabled.',
      },
      9: {
        name: 'Extreme',
        compressionRate: 90,
        latency: 300,
        features: [
          'compression',
          'caching',
          'tracking-block',
          'encryption',
          'cookie-control',
          'ad-block',
          'javascript-control',
          'image-optimization',
        ],
        description: 'Extreme mode. 90% compression, maximum protection.',
      },
      10: {
        name: 'Ultimate',
        compressionRate: 99,
        latency: 400,
        features: [
          'compression',
          'caching',
          'tracking-block',
          'encryption',
          'cookie-control',
          'ad-block',
          'javascript-control',
          'image-optimization',
          'font-subsetting',
          'css-minification',
        ],
        description: 'Ultimate mode. 99% compression, all features enabled.',
      },
    };

    const config = powerLevelConfig[powerLevel];

    console.log(`Power level ${powerLevel} applied for user ${userId}`, config);

    return UTILS.response(200, {
      success: true,
      powerLevel,
      config,
      appliedAt: new Date().toISOString(),
    });
  }

  return UTILS.error(405, 'Method not allowed');
};

// ============================================================================
// functions/api/health.js - ヘルスチェック
// ============================================================================

exports.health = async (event) => {
  return UTILS.response(200, {
    status: 'healthy',
    service: 'ProxyForce Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/proxy-config?proxyKey=:key',
      'POST /api/proxy-config',
      'GET /api/stats',
      'POST /api/stats',
      'GET /api/blocklists?type=:type',
      'POST /api/power-level',
      'GET /api/health',
    ],
  });
};

// ============================================================================
// 実際のNetlifyデプロイメント用の関数ファイル構成
// ============================================================================

/*
  実装の流れ：
  
  1. プロジェクトディレクトリ構成：
     proxy-extension/
     ├── netlify/
     │   └── functions/
     │       ├── api-proxy-config.js
     │       ├── api-stats.js
     │       ├── api-blocklists.js
     │       ├── api-power-level.js
     │       └── api-health.js
     ├── netlify.toml
     └── ...
  
  2. netlify.toml の設定例：
     [build]
       command = "echo 'No build needed'"
       functions = "netlify/functions"
       publish = "."

     [[redirects]]
       from = "/api/*"
       to = "/.netlify/functions/:splat"
       status = 200

  3. 各ファイル（例：api-proxy-config.js）：
     exports.handler = async (event) => {
       // 上記のexports.proxyConfig関数の内容
     }

  4. デプロイ：
     $ netlify deploy
*/

console.log('Netlify Functions loaded');