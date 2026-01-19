// netlify/functions/fetch-github-posts.js
// GitHub から投稿を取得（ルート posts.json + data フォルダ内の他のファイル）

const GITHUB_API = 'https://api.github.com';

exports.handler = async (event) => {
    try {
        const owner = process.env.VITE_GITHUB_OWNER || 'ROBA12551';
        const repo = process.env.VITE_GITHUB_REPO || 'data';
        const token = process.env.GITHUB_TOKEN;

        console.log('📥 fetch-github-posts called');
        console.log('🔗 Config:', { owner, repo, hasToken: !!token });

        let allPosts = [];

        // 1. ルート直下の posts.json を取得（優先）
        try {
            const rootUrl = `${GITHUB_API}/repos/${owner}/${repo}/contents/posts.json`;
            console.log('🔗 Loading root posts.json:', rootUrl);

            const rootResponse = await fetch(rootUrl, {
                headers: {
                    'Authorization': token ? `token ${token}` : '',
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Netlify-Function'
                }
            });

            if (rootResponse.ok) {
                const data = await rootResponse.json();
                const content = Buffer.from(data.content, 'base64').toString('utf-8');
                let posts = JSON.parse(content);
                if (!Array.isArray(posts)) {
                    posts = [posts];
                }
                console.log(`✅ Loaded ${posts.length} posts from root posts.json`);
                allPosts = allPosts.concat(posts);
            } else if (rootResponse.status === 404) {
                console.warn('⚠️ Root posts.json not found');
            } else {
                console.error('❌ Error loading root posts.json:', rootResponse.status);
            }
        } catch (error) {
            console.error('❌ Error with root posts.json:', error.message);
        }

        // 2. data フォルダ内の他の .json ファイルを取得
        try {
            const dataFolderUrl = `${GITHUB_API}/repos/${owner}/${repo}/contents/data`;
            console.log('🔗 Listing data folder:', dataFolderUrl);

            const folderResponse = await fetch(dataFolderUrl, {
                headers: {
                    'Authorization': token ? `token ${token}` : '',
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Netlify-Function'
                }
            });

            if (folderResponse.ok) {
                const files = await folderResponse.json();
                console.log('📁 Files found:', files.length);

                // posts.json 以外の .json ファイルを探す
                const jsonFiles = files.filter(f => 
                    f.name.endsWith('.json') && 
                    f.type === 'file' && 
                    f.name !== 'posts.json'  // ルートの posts.json とは別
                );
                console.log('📄 JSON files in data folder:', jsonFiles.map(f => f.name).join(', '));

                for (const file of jsonFiles) {
                    try {
                        console.log(`📥 Loading ${file.name}...`);
                        const fileUrl = `${GITHUB_API}/repos/${owner}/${repo}/contents/data/${file.name}`;
                        const fileResponse = await fetch(fileUrl, {
                            headers: {
                                'Authorization': token ? `token ${token}` : '',
                                'Accept': 'application/vnd.github.v3+json',
                                'User-Agent': 'Netlify-Function'
                            }
                        });

                        if (!fileResponse.ok) {
                            console.warn(`⚠️ Failed to load ${file.name}: ${fileResponse.status}`);
                            continue;
                        }

                        const fileData = await fileResponse.json();
                        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                        let posts = JSON.parse(content);
                        if (!Array.isArray(posts)) {
                            posts = [posts];
                        }

                        console.log(`✅ Loaded ${posts.length} posts from ${file.name}`);
                        allPosts = allPosts.concat(posts);
                    } catch (error) {
                        console.error(`❌ Error loading ${file.name}:`, error.message);
                    }
                }
            } else if (folderResponse.status === 404) {
                console.warn('⚠️ data folder not found');
            } else {
                console.error('❌ Error listing data folder:', folderResponse.status);
            }
        } catch (error) {
            console.error('❌ Error with data folder:', error.message);
        }

        // 3. スコア付けしてソート
        allPosts = allPosts.map(post => ({
            ...post,
            score: calculateScore(post)
        })).sort((a, b) => b.score - a.score);

        console.log('✅ Total posts fetched:', allPosts.length);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                posts: allPosts,
                count: allPosts.length,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('❌ Error:', error.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                posts: [], 
                count: 0,
                error: error.message 
            })
        };
    }
};

function calculateScore(post) {
    const now = new Date();
    const postDate = new Date(post.createdAt);
    const ageHours = (now - postDate) / (1000 * 60 * 60);
    
    const engagement = (post.engagementCount?.likes || 0) +
                       (post.engagementCount?.reposts || 0) +
                       (post.engagementCount?.replies || 0);
    
    const recency = Math.exp(-ageHours / 24);
    const popularity = engagement / Math.max(1, post.views || 1);
    
    return (popularity * 0.6) + (recency * 0.4) + Math.random() * 10;
}