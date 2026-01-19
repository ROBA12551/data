// netlify/functions/fetch-impressions.js
// GitHub から impression 数を取得

const GITHUB_API = 'https://api.github.com';

exports.handler = async (event) => {
    try {
        const owner = process.env.VITE_GITHUB_OWNER || 'ROBA12551';
        const repo = process.env.VITE_GITHUB_REPO || 'data';
        const token = process.env.GITHUB_TOKEN;

        console.log('📥 fetch-impressions called');

        // GitHub から impressions.json を取得
        const apiUrl = `${GITHUB_API}/repos/${owner}/${repo}/contents/impressions.json`;
        console.log('🔗 URL:', apiUrl);

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': token ? `token ${token}` : '',
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Netlify-Function'
            }
        });

        console.log('📤 Status:', response.status);

        // 404 - ファイルが見つからない（初期状態）
        if (response.status === 404) {
            console.warn('⚠️ impressions.json not found - returning empty');
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ impressions: {} })
            };
        }

        if (!response.ok) {
            console.error('❌ GitHub API error:', response.status);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ impressions: {}, error: `Status ${response.status}` })
            };
        }

        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        const impressions = JSON.parse(content);

        console.log('✅ Fetched impressions');

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                impressions: impressions,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // エラー時は空を返す（フォールバック）
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                impressions: {},
                error: error.message
            })
        };
    }
};