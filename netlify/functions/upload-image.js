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
        console.log('📥 Upload request received');
        
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
                body: JSON.stringify({ error: 'Image data and anonymousId required' })
            };
        }

        // Base64 データを抽出
        let base64Data = imageData;
        if (imageData.includes(',')) {
            base64Data = imageData.split(',')[1];
        }

        console.log('📊 Image info:', { anonymousId, fileName, base64Length: base64Data.length });

        // 環境変数を確認
        const owner = process.env.VITE_GITHUB_OWNER || 'ROBA12551';
        const repo = process.env.VITE_GITHUB_REPO || 'data';
        const token = process.env.GITHUB_TOKEN;

        console.log('🔗 GitHub config:', { owner, repo, hasToken: !!token });

        if (!token) {
            console.error('❌ GitHub token not configured');
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        // 画像ファイル名を生成
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        
        // ファイル名の拡張子を取得
        const ext = fileName.split('.').pop() || 'jpg';
        
        // 画像ファイル名（data フォルダに保存）
        const imageFileName = `${timestamp}_${random}.${ext}`;
        const imagePath = `data/images/${imageFileName}`;
        
        console.log('📄 Image path:', imagePath);

        // GitHub に画像をアップロード（data/images/ フォルダ）
        const imageUploadUrl = `${GITHUB_API}/repos/${owner}/${repo}/contents/${imagePath}`;
        
        console.log('🔗 Image upload URL:', imageUploadUrl);
        
        const imageUploadResponse = await fetch(imageUploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'netlify-function'
            },
            body: JSON.stringify({
                message: `Upload image: ${imageFileName}`,
                content: base64Data,
                branch: 'main'
            })
        });

        console.log('📤 Image upload response:', imageUploadResponse.status);

        if (!imageUploadResponse.ok) {
            const errorData = await imageUploadResponse.json().catch(() => ({}));
            console.error('❌ Image upload failed:', imageUploadResponse.status, errorData);
            throw new Error(`Image upload failed: ${imageUploadResponse.status}`);
        }

        // 画像の URL（posts.json で保存）
        const imageUrl = `data/images/${imageFileName}`;

        console.log(`✓ Image uploaded: ${imageUrl}`);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                image: {
                    url: imageUrl,
                    name: imageFileName,
                    path: imagePath,
                    uploadedAt: new Date().toISOString()
                }
            })
        };
    } catch (error) {
        console.error('❌ Upload error:', error.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};