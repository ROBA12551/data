
const https = require('https');

const FINNHUB_KEY = process.env.FINNHUB_KEY;
const EXCHANGE_RATE_KEY = process.env.EXCHANGE_RATE_KEY;

// エラーメッセージ定義
const ErrorMessages = {
    MISSING_KEY: 'APIキーが設定されていません',
    INVALID_ACTION: '無効なアクションです',
    INVALID_SYMBOL: 'シンボルが指定されていません',
    INVALID_CURRENCY: '通貨が指定されていません',
    NETWORK_ERROR: 'ネットワークエラーが発生しました',
    PARSE_ERROR: 'JSONパースエラーが発生しました'
};

/**
 * HTTPSリクエストを実行してJSONを取得
 */
function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';

            // データ受信
            res.on('data', chunk => data += chunk);

            // 受信完了
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`${ErrorMessages.PARSE_ERROR}: ${e.message}`));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`${ErrorMessages.NETWORK_ERROR}: ${err.message}`));
        });
    });
}

/**
 * 株価を取得
 */
async function getStockQuote(symbol) {
    if (!symbol || typeof symbol !== 'string') {
        throw new Error(ErrorMessages.INVALID_SYMBOL);
    }
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`;
    return await fetchJSON(url);
}

/**
 * ローソク足データを取得
 */
async function getStockCandles(symbol, resolution, from, to) {
    if (!symbol || typeof symbol !== 'string') {
        throw new Error(ErrorMessages.INVALID_SYMBOL);
    }
    if (!resolution || !from || !to) {
        throw new Error('resolution, from, toは必須です');
    }
    
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolution)}&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
    return await fetchJSON(url);
}

/**
 * 企業プロフィールを取得
 */
async function getCompanyProfile(symbol) {
    if (!symbol || typeof symbol !== 'string') {
        throw new Error(ErrorMessages.INVALID_SYMBOL);
    }
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`;
    return await fetchJSON(url);
}

/**
 * 為替レートを取得
 */
async function getExchangeRate(fromCurrency, toCurrency) {
    if (!fromCurrency || typeof fromCurrency !== 'string') {
        throw new Error('fromCurrencyが指定されていません');
    }
    if (!toCurrency || typeof toCurrency !== 'string') {
        throw new Error('toCurrencyが指定されていません');
    }
    
    const url = `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_KEY}/latest/${encodeURIComponent(fromCurrency)}`;
    return await fetchJSON(url);
}

/**
 * リクエストボディをパース
 */
function parseEventBody(eventBody) {
    try {
        return JSON.parse(eventBody);
    } catch (e) {
        throw new Error(`リクエストボディのパースに失敗しました: ${e.message}`);
    }
}

/**
 * Lambda ハンドラー
 */
exports.handler = async (event) => {
    try {
        // APIキーの確認
        if (!FINNHUB_KEY || !EXCHANGE_RATE_KEY) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: ErrorMessages.MISSING_KEY })
            };
        }

        // リクエストボディのパース
        const { action, symbol, resolution, from, to, fromCurrency, toCurrency } = parseEventBody(event.body);

        // アクションの検証
        if (!action || typeof action !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: ErrorMessages.INVALID_ACTION })
            };
        }

        let result;

        // アクション処理
        switch (action) {
            case 'quote':
                result = await getStockQuote(symbol);
                break;
            case 'candles':
                result = await getStockCandles(symbol, resolution, from, to);
                break;
            case 'profile':
                result = await getCompanyProfile(symbol);
                break;
            case 'exchange':
                result = await getExchangeRate(fromCurrency, toCurrency);
                break;
            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: `不正なアクション: ${action}` })
                };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
    } catch (error) {
        console.error('エラー:', error);
        return {
            statusCode: error.statusCode || 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};