// netlify/functions/create-comment.js
// コメントを作成して GitHub に保存

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { postId, text, name } = JSON.parse(event.body || "{}");

    if (!postId || !text) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields (postId, text)" }),
      };
    }

    if (text.length > 500) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Comment exceeds 500 characters" }),
      };
    }

    const owner = process.env.VITE_GITHUB_OWNER;
    const repo = process.env.VITE_GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Missing env vars (VITE_GITHUB_OWNER / VITE_GITHUB_REPO / GITHUB_TOKEN)",
        }),
      };
    }

    const commentData = {
      id: `comment_${Date.now()}`,
      postId: postId,
      name: name || "Anonymous",
      text: text,
      createdAt: new Date().toISOString(),
      helpful: 0,
    };

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/comments.json`;

    // comments.json を取得
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    let comments = [];
    let sha = undefined;

    if (getRes.ok) {
      const meta = await getRes.json();
      sha = meta.sha;

      const decoded = meta.content
        ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
        : "[]";

      comments = decoded ? JSON.parse(decoded) : [];
    } else if (getRes.status === 404) {
      // ファイルが存在しない → 自動作成
      comments = [];
      sha = undefined;
    } else {
      const errText = await getRes.text().catch(() => "");
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "GitHub API error (GET)",
          status: getRes.status,
          detail: errText.slice(0, 500),
        }),
      };
    }

    // 新しいコメントを先頭に追加
    comments.unshift(commentData);

    // 最新1000件のみ保存（ファイルサイズ制限）
    if (comments.length > 1000) {
      comments = comments.slice(0, 1000);
    }

    const newContentB64 = Buffer.from(JSON.stringify(comments, null, 2), "utf8").toString("base64");

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `Add comment to post: ${postId}`,
        content: newContentB64,
        ...(sha ? { sha } : {}),
        branch: "main",
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Failed to save comment",
          status: putRes.status,
          detail: errText.slice(0, 500),
        }),
      };
    }

    console.log(`✓ Comment created: ${commentData.id}`);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, comment: commentData }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};