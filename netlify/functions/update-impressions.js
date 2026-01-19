// netlify/functions/update-impressions.js
// 投稿のインプレッション数を更新

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { postId, increment = 1 } = JSON.parse(event.body || "{}");

    if (!postId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing postId" }),
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
          error: "Missing env vars",
        }),
      };
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/impressions.json`;

    // impressions.json を取得
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    let impressions = {};
    let sha = undefined;

    if (getRes.ok) {
      const meta = await getRes.json();
      sha = meta.sha;

      const decoded = meta.content
        ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
        : "{}";

      impressions = decoded ? JSON.parse(decoded) : {};
    } else if (getRes.status === 404) {
      // ファイルが存在しない → 自動作成
      impressions = {};
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

    // インプレッション数を更新
    const currentImpressions = impressions[postId] || 0;
    impressions[postId] = currentImpressions + increment;

    const newContentB64 = Buffer.from(JSON.stringify(impressions, null, 2), "utf8").toString("base64");

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `Update impressions for post: ${postId}`,
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
          error: "Failed to update impressions",
          status: putRes.status,
          detail: errText.slice(0, 500),
        }),
      };
    }

    console.log(`✓ Impressions updated: ${postId} = ${impressions[postId]}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        postId: postId,
        impressions: impressions[postId],
      }),
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