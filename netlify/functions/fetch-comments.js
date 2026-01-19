exports.handler = async (event) => {
  try {
    const owner = process.env.VITE_GITHUB_OWNER;
    const repo = process.env.VITE_GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;

    console.log('📥 fetch-comments called');
    console.log('🔗 Config:', { 
      hasOwner: !!owner, 
      hasRepo: !!repo, 
      hasToken: !!token,
      owner: owner || 'undefined',
      repo: repo || 'undefined'
    });

    if (!owner || !repo || !token) {
      console.error('❌ Missing environment variables');
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Missing env vars (VITE_GITHUB_OWNER / VITE_GITHUB_REPO / GITHUB_TOKEN)",
          details: {
            owner: !!owner,
            repo: !!repo,
            token: !!token
          }
        }),
      };
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/comments.json`;
    console.log('🔗 API URL:', apiUrl);

    // comments.json を取得
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Netlify-Function",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      timeout: 10000 // 10秒でタイムアウト
    });

    console.log('📤 Response status:', getRes.status);

    if (!getRes.ok) {
      if (getRes.status === 404) {
        console.warn('⚠️ comments.json not found, returning empty array');
        // ファイルが存在しない → 空配列を返す
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comments: [] }),
        };
      }

      const errText = await getRes.text().catch(() => "");
      console.error('❌ GitHub API error:', getRes.status, errText.slice(0, 200));
      
      return {
        statusCode: 200, // ✅ 200を返して、フロントエンドでフォールバックさせる
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comments: [], // 空配列を返す
          warning: `GitHub API returned ${getRes.status}`,
        }),
      };
    }

    const meta = await getRes.json();

    if (!meta.content) {
      console.warn('⚠️ No content in response');
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: [] }),
      };
    }

    // ✅ Base64デコードを改善
    let decoded = '';
    try {
      decoded = Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8");
    } catch (decodeError) {
      console.error('❌ Base64 decode error:', decodeError.message);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          comments: [],
          warning: 'Failed to decode comments'
        }),
      };
    }

    // ✅ JSON解析エラーハンドリング
    let comments = [];
    try {
      comments = decoded ? JSON.parse(decoded) : [];
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message, 'Content:', decoded.slice(0, 200));
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          comments: [],
          warning: 'Failed to parse comments JSON'
        }),
      };
    }

    // ✅ 配列チェック
    if (!Array.isArray(comments)) {
      console.warn('⚠️ Comments is not an array, converting');
      comments = [comments];
    }

    console.log(`✅ Fetched ${comments.length} comments from GitHub`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        comments: comments,
        count: comments.length
      }),
    };
  } catch (error) {
    console.error('❌ Unexpected error:', error.message, error.stack);
    return {
      statusCode: 200, // ✅ 200を返してエラーをハンドルさせる
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        comments: [],
        error: error.message 
      }),
    };
  }
};
