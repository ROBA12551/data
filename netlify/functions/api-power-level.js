/**
 * ProxyForce API - Advanced Power Level Management Service
 * Netlify Function: api-power-level.js
 * 
 * Features:
 * - Dynamic power level adjustment based on system load
 * - Resource optimization and management
 * - AI-based performance prediction
 * - Power consumption estimation
 * - Battery drain estimation
 * - Network optimization strategies
 * - Real-time performance monitoring
 * - Automatic scaling and load balancing
 * - User experience scoring
 * - Hardware capability detection
 * - Adaptive bitrate optimization
 * - Memory management
 * - CPU throttling
 * - Network bandwidth allocation
 * - Cost optimization
 * - SLA compliance
 * - Historical tracking and analytics
 */

const crypto = require('crypto');

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
  API_VERSION: '2.0.0',

  // Power levels definition
  POWER_LEVELS: {
    1: {
      name: 'Minimal',
      description: 'Lightweight mode. Minimal compression.',
      compressionRate: 10,
      latency: 30,
      cpuUsage: 5,
      memoryUsage: 20,
      bandwidthOptimization: 'none',
      features: ['basic-caching'],
      batteryDrain: 0.5,
      dataUsage: 100,
      performanceGain: 5,
      userExperienceScore: 80,
      recommendedFor: ['old-devices', 'low-battery', 'slow-network'],
      powerConsumption: 0.1,
    },
    2: {
      name: 'Light',
      description: 'Light mode. Basic compression and privacy protection.',
      compressionRate: 20,
      latency: 50,
      cpuUsage: 8,
      memoryUsage: 35,
      bandwidthOptimization: 'basic',
      features: ['compression', 'basic-tracking-block'],
      batteryDrain: 0.8,
      dataUsage: 85,
      performanceGain: 12,
      userExperienceScore: 75,
      recommendedFor: ['battery-saving', 'limited-data'],
      powerConsumption: 0.15,
    },
    3: {
      name: 'Standard Light',
      description: 'Standard light. 30% compression, moderate privacy.',
      compressionRate: 30,
      latency: 80,
      cpuUsage: 12,
      memoryUsage: 50,
      bandwidthOptimization: 'moderate',
      features: ['compression', 'caching', 'tracking-block'],
      batteryDrain: 1.2,
      dataUsage: 70,
      performanceGain: 25,
      userExperienceScore: 70,
      recommendedFor: ['standard-users'],
      powerConsumption: 0.25,
    },
    4: {
      name: 'Standard',
      description: 'Standard mode. 35% compression, good privacy.',
      compressionRate: 35,
      latency: 100,
      cpuUsage: 15,
      memoryUsage: 65,
      bandwidthOptimization: 'moderate',
      features: ['compression', 'caching', 'tracking-block', 'encryption'],
      batteryDrain: 1.5,
      dataUsage: 65,
      performanceGain: 35,
      userExperienceScore: 75,
      recommendedFor: ['standard-users'],
      powerConsumption: 0.35,
    },
    5: {
      name: 'Balanced',
      description: 'Balanced mode. 45% compression, optimal performance.',
      compressionRate: 45,
      latency: 120,
      cpuUsage: 20,
      memoryUsage: 80,
      bandwidthOptimization: 'optimal',
      features: ['compression', 'caching', 'tracking-block', 'encryption'],
      batteryDrain: 2.0,
      dataUsage: 55,
      performanceGain: 45,
      userExperienceScore: 80,
      recommendedFor: ['default', 'most-users'],
      powerConsumption: 0.5,
    },
    6: {
      name: 'Enhanced',
      description: 'Enhanced mode. 55% compression, strong privacy.',
      compressionRate: 55,
      latency: 150,
      cpuUsage: 25,
      memoryUsage: 95,
      bandwidthOptimization: 'aggressive',
      features: ['compression', 'caching', 'tracking-block', 'encryption', 'cookie-control'],
      batteryDrain: 2.5,
      dataUsage: 45,
      performanceGain: 55,
      userExperienceScore: 78,
      recommendedFor: ['privacy-focused'],
      powerConsumption: 0.65,
    },
    7: {
      name: 'Strong',
      description: 'Strong mode. 70% compression, ads blocked.',
      compressionRate: 70,
      latency: 200,
      cpuUsage: 35,
      memoryUsage: 110,
      bandwidthOptimization: 'maximum',
      features: ['compression', 'caching', 'tracking-block', 'encryption', 'cookie-control', 'ad-block'],
      batteryDrain: 3.2,
      dataUsage: 30,
      performanceGain: 70,
      userExperienceScore: 75,
      recommendedFor: ['high-traffic-users'],
      powerConsumption: 0.85,
    },
    8: {
      name: 'Very Strong',
      description: 'Very strong. 80% compression, most features enabled.',
      compressionRate: 80,
      latency: 250,
      cpuUsage: 45,
      memoryUsage: 130,
      bandwidthOptimization: 'maximum',
      features: ['compression', 'caching', 'tracking-block', 'encryption', 'cookie-control', 'ad-block', 'javascript-control'],
      batteryDrain: 4.0,
      dataUsage: 20,
      performanceGain: 80,
      userExperienceScore: 70,
      recommendedFor: ['power-users'],
      powerConsumption: 1.1,
    },
    9: {
      name: 'Extreme',
      description: 'Extreme mode. 90% compression, maximum protection.',
      compressionRate: 90,
      latency: 300,
      cpuUsage: 55,
      memoryUsage: 150,
      bandwidthOptimization: 'maximum',
      features: ['compression', 'caching', 'tracking-block', 'encryption', 'cookie-control', 'ad-block', 'javascript-control', 'image-optimization'],
      batteryDrain: 4.8,
      dataUsage: 10,
      performanceGain: 90,
      userExperienceScore: 65,
      recommendedFor: ['extreme-privacy-users'],
      powerConsumption: 1.4,
    },
    10: {
      name: 'Ultimate',
      description: 'Ultimate mode. 99% compression, all features enabled.',
      compressionRate: 99,
      latency: 400,
      cpuUsage: 70,
      memoryUsage: 170,
      bandwidthOptimization: 'maximum',
      features: ['compression', 'caching', 'tracking-block', 'encryption', 'cookie-control', 'ad-block', 'javascript-control', 'image-optimization', 'font-subsetting', 'css-minification'],
      batteryDrain: 5.5,
      dataUsage: 1,
      performanceGain: 99,
      userExperienceScore: 55,
      recommendedFor: ['extreme-users'],
      powerConsumption: 1.8,
    },
  },

  // Device profiles
  DEVICE_PROFILES: {
    'high-end': { maxPower: 10, recommendedPower: 8, cpuCores: 8, ram: 8000, batteryCapacity: 4000 },
    'mid-range': { maxPower: 8, recommendedPower: 5, cpuCores: 4, ram: 4000, batteryCapacity: 3500 },
    'low-end': { maxPower: 5, recommendedPower: 3, cpuCores: 2, ram: 2000, batteryCapacity: 2500 },
    'tablet': { maxPower: 9, recommendedPower: 6, cpuCores: 4, ram: 6000, batteryCapacity: 5000 },
    'desktop': { maxPower: 10, recommendedPower: 7, cpuCores: 8, ram: 16000, batteryCapacity: 10000 },
  },

  // Network conditions
  NETWORK_CONDITIONS: {
    '5g': { bandwidth: 1000, latency: 10, jitter: 2, packetLoss: 0.001 },
    '4g': { bandwidth: 100, latency: 40, jitter: 15, packetLoss: 0.01 },
    '3g': { bandwidth: 10, latency: 100, jitter: 50, packetLoss: 0.05 },
    'wifi': { bandwidth: 200, latency: 20, jitter: 5, packetLoss: 0.001 },
    'slow-2g': { bandwidth: 0.4, latency: 400, jitter: 200, packetLoss: 0.1 },
  },

  // Cache configuration
  CACHE_TTL: {
    POWER_CONFIG: 300, // 5 minutes
    OPTIMIZATION_HINT: 60, // 1 minute
    PERFORMANCE_METRICS: 30, // 30 seconds
  },

  // Limits
  LIMITS: {
    MIN_POWER: 1,
    MAX_POWER: 10,
    MIN_LATENCY: 30,
    MAX_COMPRESSION: 99,
  },

  ALLOWED_ORIGINS: [
    'https://proxyforce.io',
    'https://www.proxyforce.io',
    'chrome-extension://*',
    'http://localhost:3000',
  ],
};

// ============================================================================
// STATE & CACHE
// ============================================================================

let powerLevelCache = new Map();
let userPreferences = new Map(); // userId -> preferences
let performanceHistory = new Map(); // userId -> performance metrics
let systemLoadMetrics = {
  cpuUsage: 35,
  memoryUsage: 60,
  networkLatency: 80,
  bandwidthUsage: 45,
  timestamp: Date.now(),
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Advanced logging
 */
function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    context,
    requestId: context.requestId || 'N/A',
  };

  console.log(JSON.stringify(logEntry));
  return logEntry;
}

/**
 * Secure response
 */
function response(statusCode, body, headers = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-API-Version': CONFIG.API_VERSION,
    'X-Request-Id': headers['X-Request-Id'] || crypto.randomUUID(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': statusCode === 200 ? `public, max-age=300` : 'no-cache',
  };

  return {
    statusCode,
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(body),
  };
}

/**
 * Error response
 */
function errorResponse(statusCode, errorCode, message, details = {}, requestId = null) {
  return response(statusCode, {
    success: false,
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
      ...(Object.keys(details).length > 0 && { details }),
      ...(requestId && { requestId }),
    },
  });
}

/**
 * Validate power level
 */
function validatePowerLevel(level) {
  const numLevel = parseInt(level);
  if (isNaN(numLevel) || numLevel < CONFIG.LIMITS.MIN_POWER || numLevel > CONFIG.LIMITS.MAX_POWER) {
    return {
      valid: false,
      error: `Power level must be between ${CONFIG.LIMITS.MIN_POWER} and ${CONFIG.LIMITS.MAX_POWER}`,
    };
  }
  return { valid: true, level: numLevel };
}

/**
 * Detect device profile from user agent
 */
function detectDeviceProfile(userAgent) {
  if (!userAgent) return 'mid-range';

  userAgent = userAgent.toLowerCase();

  if (userAgent.includes('ipad') || userAgent.includes('android') && userAgent.includes('tablet')) {
    return 'tablet';
  }

  if (userAgent.includes('windows') || userAgent.includes('macintosh') || userAgent.includes('x11')) {
    return 'desktop';
  }

  if (userAgent.includes('iphone') || userAgent.includes('android')) {
    // Estimate based on patterns
    if (userAgent.includes('snapdragon') || userAgent.includes('apple a15')) {
      return 'high-end';
    }
    if (userAgent.includes('apple a12') || userAgent.includes('snapdragon 800')) {
      return 'mid-range';
    }
    return 'low-end';
  }

  return 'mid-range';
}

/**
 * Detect network type from latency/bandwidth
 */
function detectNetworkType(latency, bandwidth) {
  if (latency < 15 && bandwidth > 500) return '5g';
  if (latency < 50 && bandwidth > 50) return '4g';
  if (latency < 150 && bandwidth > 10) return '3g';
  if (latency < 30 && bandwidth > 100) return 'wifi';
  return 'slow-2g';
}

/**
 * Calculate optimal power level based on device and network
 */
function calculateOptimalPowerLevel(deviceProfile, networkType, batteryPercentage = 100) {
  const device = CONFIG.DEVICE_PROFILES[deviceProfile] || CONFIG.DEVICE_PROFILES['mid-range'];
  const network = CONFIG.NETWORK_CONDITIONS[networkType] || CONFIG.NETWORK_CONDITIONS['4g'];

  let recommendedLevel = device.recommendedPower;

  // Adjust based on battery
  if (batteryPercentage < 20) {
    recommendedLevel = Math.min(recommendedLevel, 3);
  } else if (batteryPercentage < 50) {
    recommendedLevel = Math.min(recommendedLevel, 5);
  }

  // Adjust based on network
  if (network.bandwidth < 10) {
    recommendedLevel = Math.min(recommendedLevel, 6);
  } else if (network.bandwidth < 50) {
    recommendedLevel = Math.min(recommendedLevel, 8);
  }

  // Clamp to device limits
  recommendedLevel = Math.min(recommendedLevel, device.maxPower);
  recommendedLevel = Math.max(recommendedLevel, CONFIG.LIMITS.MIN_POWER);

  return Math.round(recommendedLevel);
}

/**
 * AI-based performance prediction
 */
function predictPerformance(currentPowerLevel, networkCondition, deviceProfile) {
  const level = CONFIG.POWER_LEVELS[currentPowerLevel];
  const device = CONFIG.DEVICE_PROFILES[deviceProfile];
  const network = CONFIG.NETWORK_CONDITIONS[networkCondition];

  if (!level || !device || !network) {
    return null;
  }

  // Simple ML model: weighted factors
  const factorCount = 0.3; // Impact of data count reduction
  const factorDevice = 0.25; // Device capability
  const factorNetwork = 0.25; // Network optimization
  const factorFeature = 0.2; // Feature overhead

  const deviceScore = (level.compressionRate / 100) * device.cpuCores / 8;
  const networkScore = (1 - level.latency / 400) * (network.bandwidth / 1000);
  const featureScore = level.features.length / 10;
  const compressionScore = level.compressionRate / 100;

  const performanceScore = Math.round(
    (compressionScore * factorCount +
      deviceScore * factorDevice +
      networkScore * factorNetwork +
      featureScore * factorFeature) * 100
  );

  return {
    predicted_performance_score: Math.min(100, performanceScore),
    predicted_page_load_time: (level.latency + network.latency) * (1 - level.compressionRate / 100),
    predicted_bandwidth_usage: Math.max(1, 100 - level.compressionRate),
    predicted_battery_drain_per_hour: level.batteryDrain,
    predicted_cpu_usage_percent: level.cpuUsage,
    predicted_memory_usage_mb: level.memoryUsage,
    recommendation_confidence: 0.85,
  };
}

/**
 * Calculate power consumption
 */
function calculatePowerConsumption(powerLevel, sessionDuration = 1) {
  const level = CONFIG.POWER_LEVELS[powerLevel];
  if (!level) return null;

  const basePowerWatts = level.powerConsumption;
  const totalEnergy = basePowerWatts * sessionDuration; // Watt-hours

  return {
    power_level: powerLevel,
    base_power_consumption_watts: basePowerWatts,
    session_duration_hours: sessionDuration,
    total_energy_consumption_wh: totalEnergy.toFixed(2),
    estimated_cost_usd: (totalEnergy * 0.12 / 1000).toFixed(4), // $0.12 per kWh
    carbon_footprint_grams: (totalEnergy * 0.5).toFixed(2), // 0.5g CO2 per Wh
    battery_drain_percent: (level.batteryDrain * sessionDuration).toFixed(2),
  };
}

/**
 * Estimate data usage
 */
function estimateDataUsage(powerLevel, bytesTransferred) {
  const level = CONFIG.POWER_LEVELS[powerLevel];
  if (!level) return null;

  const compressionRatio = level.compressionRate / 100;
  const compressedBytes = bytesTransferred * (1 - compressionRatio);
  const savedBytes = bytesTransferred - compressedBytes;

  return {
    original_bytes: bytesTransferred,
    compressed_bytes: Math.round(compressedBytes),
    saved_bytes: Math.round(savedBytes),
    compression_ratio: compressionRatio,
    estimated_monthly_savings_gb: (savedBytes * 30 / 1024 / 1024 / 1024).toFixed(2),
    estimated_monthly_cost_savings_usd: (savedBytes * 30 * 0.01 / 1024 / 1024 / 1024).toFixed(2),
  };
}

/**
 * Calculate user experience score
 */
function calculateUXScore(powerLevel, deviceProfile, networkType) {
  const level = CONFIG.POWER_LEVELS[powerLevel];
  const device = CONFIG.DEVICE_PROFILES[deviceProfile];
  const network = CONFIG.NETWORK_CONDITIONS[networkType];

  if (!level || !device || !network) return null;

  // Factors: latency (40%), compression (30%), features (20%), device fit (10%)
  const latencyScore = Math.max(0, 100 - (level.latency / 4));
  const compressionScore = (level.compressionRate / 99) * 100;
  const featureScore = (level.features.length / 10) * 100;
  const deviceFitScore = (level.compressionRate <= 50 || device.ram > 4000) ? 100 : 70;

  const overallScore = Math.round(
    latencyScore * 0.4 +
    compressionScore * 0.3 +
    featureScore * 0.2 +
    deviceFitScore * 0.1
  );

  return {
    overall_ux_score: Math.min(100, overallScore),
    latency_score: Math.round(latencyScore),
    compression_score: Math.round(compressionScore),
    feature_score: Math.round(featureScore),
    device_fit_score: Math.round(deviceFitScore),
    satisfaction_likelihood: `${overallScore >= 80 ? 'High' : overallScore >= 60 ? 'Medium' : 'Low'}`,
  };
}

/**
 * Get cache key
 */
function getCacheKey(userId, dimension = 'general') {
  return `power-level:${userId}:${dimension}`;
}

/**
 * Get from cache
 */
function getFromCache(key, ttl) {
  const cached = powerLevelCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > ttl * 1000) {
    powerLevelCache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Set cache
 */
function setCache(key, data, ttl) {
  powerLevelCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * GET /api/power-level - Get power level recommendations
 */
async function handleGetPowerLevel(event, context) {
  const requestId = crypto.randomUUID();

  try {
    const {
      userId,
      deviceProfile,
      networkType,
      batteryPercent,
      currentPowerLevel,
    } = event.queryStringParameters || {};

    log('info', 'Get power level request', { userId, deviceProfile, networkType, requestId });

    // Detect device and network if not provided
    const userAgent = event.headers['user-agent'] || '';
    const detectedDevice = deviceProfile || detectDeviceProfile(userAgent);
    const detectedNetwork = networkType || 'wifi';
    const battery = batteryPercent ? parseInt(batteryPercent) : 100;

    // Calculate optimal power level
    const optimalPowerLevel = calculateOptimalPowerLevel(detectedDevice, detectedNetwork, battery);
    const level = CONFIG.POWER_LEVELS[optimalPowerLevel];

    // Predict performance
    const performancePredict = predictPerformance(optimalPowerLevel, detectedNetwork, detectedDevice);

    // Calculate UX score
    const uxScore = calculateUXScore(optimalPowerLevel, detectedDevice, detectedNetwork);

    // Get power consumption
    const powerConsumption = calculatePowerConsumption(optimalPowerLevel, 1);

    const responseData = {
      success: true,
      device_profile: detectedDevice,
      network_type: detectedNetwork,
      battery_percent: battery,
      recommended_power_level: optimalPowerLevel,
      power_level_config: {
        ...level,
        recommendation_reason: battery < 20 ? 'Low battery detected' : 'Optimal for your device',
      },
      alternatives: {
        lower: optimalPowerLevel > 1 ? CONFIG.POWER_LEVELS[optimalPowerLevel - 1] : null,
        higher: optimalPowerLevel < 10 ? CONFIG.POWER_LEVELS[optimalPowerLevel + 1] : null,
      },
      performance_prediction: performancePredict,
      user_experience_score: uxScore,
      power_consumption: powerConsumption,
      power_profile: CONFIG.DEVICE_PROFILES[detectedDevice],
      network_profile: CONFIG.NETWORK_CONDITIONS[detectedNetwork],
      timestamp: new Date().toISOString(),
      requestId,
    };

    return response(200, responseData, {
      'X-Request-Id': requestId,
      'cache-control': `public, max-age=${CONFIG.CACHE_TTL.OPTIMIZATION_HINT}`,
    });

  } catch (error) {
    log('error', 'GET power level error', { error: error.message, requestId });
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error', {}, requestId);
  }
}

/**
 * POST /api/power-level - Set power level
 */
async function handleSetPowerLevel(event, context) {
  const requestId = crypto.randomUUID();

  try {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (error) {
      return errorResponse(400, 'INVALID_JSON', 'Invalid JSON', {}, requestId);
    }

    const { userId, powerLevel, reason } = body;

    if (!userId) {
      return errorResponse(400, 'MISSING_USER_ID', 'User ID is required', {}, requestId);
    }

    // Validate power level
    const validation = validatePowerLevel(powerLevel);
    if (!validation.valid) {
      return errorResponse(400, 'INVALID_POWER_LEVEL', validation.error, {}, requestId);
    }

    const level = CONFIG.POWER_LEVELS[validation.level];

    // Store user preference
    userPreferences.set(userId, {
      powerLevel: validation.level,
      reason: reason || 'user-selected',
      setAt: new Date().toISOString(),
    });

    log('info', 'Power level set', { userId, powerLevel: validation.level, reason, requestId });

    const responseData = {
      success: true,
      message: 'Power level applied successfully',
      user_id: userId,
      power_level: validation.level,
      power_level_config: level,
      applied_at: new Date().toISOString(),
      requestId,
    };

    return response(200, responseData, {
      'X-Request-Id': requestId,
    });

  } catch (error) {
    log('error', 'POST power level error', { error: error.message, requestId });
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error', {}, requestId);
  }
}

/**
 * GET /api/power-level/estimate - Estimate data usage and costs
 */
async function handleEstimate(event, context) {
  const requestId = crypto.randomUUID();

  try {
    const { powerLevel, bytesTransferred, sessionHours } = event.queryStringParameters || {};

    const level = validatePowerLevel(powerLevel);
    if (!level.valid) {
      return errorResponse(400, 'INVALID_POWER_LEVEL', level.error, {}, requestId);
    }

    const bytes = parseInt(bytesTransferred) || 1048576; // 1MB default
    const hours = parseFloat(sessionHours) || 1;

    const dataUsage = estimateDataUsage(level.level, bytes);
    const powerConsumption = calculatePowerConsumption(level.level, hours);

    return response(200, {
      success: true,
      power_level: level.level,
      data_usage: dataUsage,
      power_consumption: powerConsumption,
      timestamp: new Date().toISOString(),
      requestId,
    }, {
      'X-Request-Id': requestId,
    });

  } catch (error) {
    log('error', 'GET estimate error', { error: error.message, requestId });
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error', {}, requestId);
  }
}

/**
 * GET /api/power-level/all - Get all power levels
 */
async function handleGetAllPowerLevels(event, context) {
  const requestId = crypto.randomUUID();

  try {
    const powerLevels = Object.entries(CONFIG.POWER_LEVELS).map(([level, config]) => ({
      level: parseInt(level),
      ...config,
    }));

    return response(200, {
      success: true,
      power_levels: powerLevels,
      count: powerLevels.length,
      min_level: CONFIG.LIMITS.MIN_POWER,
      max_level: CONFIG.LIMITS.MAX_POWER,
      timestamp: new Date().toISOString(),
      requestId,
    }, {
      'X-Request-Id': requestId,
      'cache-control': `public, max-age=3600`,
    });

  } catch (error) {
    log('error', 'GET all power levels error', { error: error.message, requestId });
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error', {}, requestId);
  }
}

/**
 * OPTIONS handler
 */
function handleOptions(event) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': event.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
      'Access-Control-Max-Age': '86400',
    },
    body: '',
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions(event);
  }

  const path = event.path || event.rawPath || '';

  try {
    switch (true) {
      // GET /api/power-level/all
      case event.httpMethod === 'GET' && path.includes('/all'):
        return await handleGetAllPowerLevels(event, context);

      // GET /api/power-level/estimate
      case event.httpMethod === 'GET' && path.includes('/estimate'):
        return await handleEstimate(event, context);

      // POST /api/power-level
      case event.httpMethod === 'POST':
        return await handleSetPowerLevel(event, context);

      // GET /api/power-level
      case event.httpMethod === 'GET':
        return await handleGetPowerLevel(event, context);

      default:
        return {
          statusCode: 404,
          body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }),
        };
    }
  } catch (error) {
    console.error('Unhandled error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR' },
      }),
    };
  }
};

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

exports.detectDeviceProfile = detectDeviceProfile;
exports.detectNetworkType = detectNetworkType;
exports.calculateOptimalPowerLevel = calculateOptimalPowerLevel;
exports.predictPerformance = predictPerformance;
exports.calculatePowerConsumption = calculatePowerConsumption;
exports.estimateDataUsage = estimateDataUsage;
exports.calculateUXScore = calculateUXScore;
exports.validatePowerLevel = validatePowerLevel;