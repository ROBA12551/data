const GITHUB_API = 'https://api.github.com';

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const postData = JSON.parse(event.body);

        // バリデーション
        const validation = validatePostData(postData);
        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: validation.error })
            };
        }

        // スパム検出
        const spamCheck = detectSpam(postData.content, postData.displayName);
        if (spamCheck.isSpam) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: spamCheck.reason })
            };
        }

        // 新規投稿オブジェクトを作成
        const newPost = {
            id: `post_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            anonymousId: postData.anonymousId,
            displayName: postData.displayName,
            content: postData.content,
            images: postData.images || [],  // ここに画像 URL が含まれる（data/images/... 形式）
            urls: postData.urls || [],
            hashtags: postData.hashtags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            views: 0,
            engagementCount: {
                likes: 0,
                reposts: 0,
                replies: 0,
                bookmarks: 0
            }
        };

        // GitHub から現在の posts.json を取得
        const owner = process.env.VITE_GITHUB_OWNER || 'ROBA12551';
        const repo = process.env.VITE_GITHUB_REPO || 'data';
        const token = process.env.GITHUB_TOKEN;

        console.log('🔗 GitHub config:', { 
            owner,
            repo,
            hasToken: !!token,
            tokenLength: token ? token.length : 0,
            tokenPrefix: token ? token.substring(0, 10) : 'NONE'
        });

        if (!token) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        // 現在の posts.json 取得（ルート直下）
        const getResponse = await fetch(
            `${GITHUB_API}/repos/${owner}/${repo}/contents/posts.json`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'netlify-function'
                }
            }
        );

        let sha = null;
        let posts = [];

        if (getResponse.ok) {
            const data = await getResponse.json();
            sha = data.sha;
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            posts = JSON.parse(content);
        } else if (getResponse.status === 404) {
            console.warn('posts.json not found, creating new');
            posts = [];
        } else {
            throw new Error(`GitHub API error: ${getResponse.status}`);
        }

        // 新規投稿を先頭に追加
        posts.unshift(newPost);

        // 古い投稿を削除（最新1000件のみ保持）
        if (posts.length > 1000) {
            posts = posts.slice(0, 1000);
        }

        // GitHub に更新（ルート直下）
        const updateContent = Buffer.from(JSON.stringify(posts, null, 2)).toString('base64');

        const putResponse = await fetch(
            `${GITHUB_API}/repos/${owner}/${repo}/contents/posts.json`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'netlify-function'
                },
                body: JSON.stringify({
                    message: `Add post by ${postData.anonymousId}`,
                    content: updateContent,
                    ...(sha && { sha: sha }),
                    branch: 'main'
                })
            }
        );

        if (!putResponse.ok) {
            throw new Error(`GitHub update failed: ${putResponse.status}`);
        }

        console.log(`✓ Post created: ${newPost.id}`);

        return {
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                post: newPost,
                message: 'Post created successfully'
            })
        };
    } catch (error) {
        console.error('Error creating post:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * 投稿データをバリデーション
 */
function validatePostData(data) {
    console.log('📋 Validating post data:', { 
        hasContent: !!data.content,
        contentLength: data.content?.length,
        hasAnonymousId: !!data.anonymousId,
        displayName: data.displayName,
        urls: data.urls,
        urlsType: typeof data.urls,
        urlsIsArray: Array.isArray(data.urls),
        urlsLength: data.urls?.length
    });

    if (!data.content || typeof data.content !== 'string') {
        console.error('❌ Validation failed: Content is required');
        return { valid: false, error: 'Content is required' };
    }

    const contentStr = data.content.trim();
    if (contentStr.length < 1 || contentStr.length > 2000) {
        console.error('❌ Validation failed: Content length invalid', contentStr.length);
        return { valid: false, error: `Content must be between 1 and 2000 characters (got ${contentStr.length})` };
    }

    if (!data.anonymousId || typeof data.anonymousId !== 'string') {
        console.error('❌ Validation failed: Anonymous ID is required');
        return { valid: false, error: 'Anonymous ID is required' };
    }

    if (data.displayName && data.displayName.length > 30) {
        console.error('❌ Validation failed: Display name too long');
        return { valid: false, error: 'Display name must be less than 30 characters' };
    }

    if (data.urls && !Array.isArray(data.urls)) {
        console.error('❌ Validation failed: URLs must be an array, got:', typeof data.urls);
        return { valid: false, error: 'URLs must be an array' };
    }

    if (data.urls && data.urls.length > 3) {
        console.error('❌ Validation failed: Too many URLs');
        return { valid: false, error: 'Maximum 3 URLs allowed' };
    }

    if (data.urls && data.urls.length > 0) {
        console.log('🔗 Validating URLs:', data.urls);
        for (const url of data.urls) {
            // URL は文字列であることを確認
            const urlStr = typeof url === 'string' ? url : (url?.url || '');
            console.log('  - Checking URL:', { urlStr, type: typeof url });
            if (!urlStr) {
                console.error('❌ Validation failed: Empty URL in urls array');
                return { valid: false, error: 'Empty URL in urls array' };
            }
            try {
                new URL(urlStr);
                console.log('  ✅ URL is valid');
            } catch (e) {
                console.error('❌ Validation failed: Invalid URL format:', urlStr, e.message);
                return { valid: false, error: `Invalid URL format: ${urlStr}` };
            }
        }
    }

    if (data.images && !Array.isArray(data.images)) {
        console.error('❌ Validation failed: Images must be an array');
        return { valid: false, error: 'Images must be an array' };
    }

    if (data.images && data.images.length > 5) {
        console.error('❌ Validation failed: Too many images');
        return { valid: false, error: 'Maximum 5 images allowed' };
    }

    console.log('✅ All validations passed');
    return { valid: true };
}

/**
 * スパム検出
 */
function detectSpam(content, displayName) {
    const spamKeywords = [
        'viagra', 'casino', 'lottery', 'cryptocurrency', 'forex',
        'click here', 'buy now', 'limited offer', 'free money'
    ];

    for (const keyword of spamKeywords) {
        if (content.toLowerCase().includes(keyword)) {
            return { isSpam: true, reason: 'Spam content detected' };
        }
    }

    if ((content.match(/http/g) || []).length > 5) {
        return { isSpam: true, reason: 'Too many URLs' };
    }

    if (/\s{30,}/.test(content)) {
        return { isSpam: true, reason: 'Invalid format detected' };
    }

    if (/(.)\1{30,}/.test(content)) {
        return { isSpam: true, reason: 'Excessive character repetition' };
    }

    if (displayName && displayName.length > 30) {
        return { isSpam: true, reason: 'Display name is too long' };
    }

    return { isSpam: false };
}