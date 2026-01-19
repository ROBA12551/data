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
        console.log('📥 Save image request received');
        
        let imageData = null;
        let anonymousId = null;
        let fileName = null;

        try {
            const bodyData = JSON.parse(event.body);
            console.log('✓ JSON parsed, keys:', Object.keys(bodyData));
            
            imageData = bodyData.data || bodyData.file;
            anonymousId = bodyData.anonymousId;
            fileName = bodyData.fileName || 'image.jpg';
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError.message);
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid JSON: ' + parseError.message })
            };
        }

        if (!imageData || !anonymousId) {
            console.error('❌ Missing required fields');
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Image data and anonymousId required',
                    received: { hasImageData: !!imageData, hasAnonymousId: !!anonymousId }
                })
            };
        }

        // Base64 データから実際の画像データを抽出
        let base64Data = imageData;
        if (imageData.includes(',')) {
            base64Data = imageData.split(',')[1];
        }

        console.log('📊 Image info:', { 
            anonymousId, 
            fileName,
            base64Length: base64Data.length
        });

        // 環境変数を確認
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
            console.error('❌ GitHub token not configured');
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        // 画像ファイル名を生成（安全なファイル名）
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        
        // ファイル名に特殊文字が含まれないようにサニタイズ
        const sanitizedFileName = fileName
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .substring(0, 50);
        
        // anonymousId をサニタイズ
        const sanitizedAnonymousId = (anonymousId || 'user')
            .replace(/[^a-zA-Z0-9#]/g, '_')
            .substring(0, 30);
        
        // ファイル名を生成
        // GitHub API は / を含むパスでエラーを返すため、ファイル名にプレフィックスを付ける
        // data_user123_1234567890_abc_IMG.jpg という形式で、トップレベルに保存
        const finalFileName = `data_${sanitizedAnonymousId}_${timestamp}_${random}_${sanitizedFileName}`;
        
        console.log('📄 Final fileName:', finalFileName);
        console.log('📊 File name parts:', {
            prefix: 'data',
            userId: sanitizedAnonymousId,
            timestamp: timestamp,
            random: random,
            original: sanitizedFileName
        });
        
        // バリデーション
        if (!finalFileName || finalFileName.trim() === '') {
            throw new Error('Invalid filename: empty after sanitization');
        }
        
        if (finalFileName.includes('/') || finalFileName.includes('\\')) {
            throw new Error('Invalid filename: contains path separators');
        }

        console.log('✅ Filename validation passed:', finalFileName);

        // GitHub にアップロード（トップレベルに保存）
        // パスに / を含めない
        const filePath = finalFileName;  // "data_user123_1234567890_abc_IMG.jpg"
        const githubApiUrl = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`;
        
        console.log('🔗 GitHub API URL:', githubApiUrl);
        console.log('🔍 URL Structure:', {
            api: GITHUB_API,
            owner: owner,
            repo: repo,
            path: filePath,
            fullPath: `contents/${filePath}`
        });
        
        const uploadResponse = await fetch(
            githubApiUrl,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'netlify-function'
                },
                body: JSON.stringify({
                    message: `Upload image: ${finalFileName}`,
                    content: base64Data,
                    branch: 'main'
                })
            }
        );

        console.log('📤 GitHub upload response:', uploadResponse.status);

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            console.error('❌ GitHub upload failed:', uploadResponse.status, errorData);
            throw new Error(`GitHub upload failed: ${uploadResponse.status} - ${JSON.stringify(errorData)}`);
        }

        // GitHub raw コンテンツ URL を生成
        const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;

        console.log(`✓ Image uploaded: ${imageUrl}`);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                image: {
                    url: imageUrl,
                    name: finalFileName,
                    path: filePath,
                    uploadedAt: new Date().toISOString()
                }
            })
        };
    } catch (error) {
        console.error('❌ Error:', error.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};