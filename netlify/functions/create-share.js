exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { itemId, itemType, platform, sharedBy } = JSON.parse(event.body || "{}");

    if (!itemId || !itemType || !platform) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const validTypes = ["post", "youtube-room", "thread", "qa"];
    const validPlatforms = ["twitter", "facebook", "line", "whatsapp", "copy"];

    if (!validTypes.includes(itemType)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid itemType" }),
      };
    }

    if (!validPlatforms.includes(platform)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid platform" }),
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

    const shareUrl = generateShareUrl(itemId, itemType);

    const shareData = {
      id: `share_${Date.now()}`,
      itemId,
      itemType,
      platform,
      sharedBy: sharedBy || "Anonymous",
      createdAt: new Date().toISOString(),
      url: shareUrl,
    };

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/shares.json`;

    // ✅ sha + content(base64) を取る
    const metaRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    let shares = [];
    let sha = undefined;

    if (metaRes.ok) {
      const meta = await metaRes.json(); // { sha, content, ... }
      sha = meta.sha;

      const decoded = meta.content
        ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
        : "[]";

      shares = decoded ? JSON.parse(decoded) : [];
    } else if (metaRes.status === 404) {
      // shares.json が無い → 新規作成
      shares = [];
      sha = undefined;
    } else {
      const errText = await metaRes.text().catch(() => "");
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "GitHub API error (GET contents)",
          status: metaRes.status,
          detail: errText.slice(0, 500),
        }),
      };
    }

    shares.unshift(shareData);

    // 最新1000件のみ保存
    if (shares.length > 1000) shares = shares.slice(0, 1000);

    const newContentB64 = Buffer.from(JSON.stringify(shares, null, 2), "utf8").toString("base64");

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `Share ${itemType} on ${platform}: ${itemId}`,
        content: newContentB64,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Failed to record share",
          status: putRes.status,
          detail: errText.slice(0, 500),
        }),
      };
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, share: shareData }),
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

function generateShareUrl(itemId, itemType) {
  const baseUrl = process.env.SITE_URL || "https://pulsenote.netlify.app";

  switch (itemType) {
    case "youtube-room":
      return `${baseUrl}?room=${encodeURIComponent(itemId)}`;
    case "post":
      return `${baseUrl}?post=${encodeURIComponent(itemId)}`;
    case "thread":
      return `${baseUrl}?thread=${encodeURIComponent(itemId)}`;
    case "qa":
      return `${baseUrl}?qa=${encodeURIComponent(itemId)}`;
    default:
      return baseUrl;
  }
}
