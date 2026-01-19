// netlify/functions/create-dm.js
// DM（ダイレクトメッセージ）を作成して保存

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { fromUserId, toUserId, message } = JSON.parse(event.body || "{}");

    if (!fromUserId || !toUserId || !message) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    if (message.length > 1000) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Message exceeds 1000 characters" }),
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

    const dmData = {
      id: `dm_${Date.now()}`,
      fromUserId: fromUserId,
      toUserId: toUserId,
      message: message,
      createdAt: new Date().toISOString(),
      read: false,
    };

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/dms.json`;

    // dms.json を取得
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    let dms = [];
    let sha = undefined;

    if (getRes.ok) {
      const meta = await getRes.json();
      sha = meta.sha;

      const decoded = meta.content
        ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
        : "[]";

      dms = decoded ? JSON.parse(decoded) : [];
    } else if (getRes.status === 404) {
      dms = [];
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

    dms.unshift(dmData);

    if (dms.length > 5000) {
      dms = dms.slice(0, 5000);
    }

    const newContentB64 = Buffer.from(JSON.stringify(dms, null, 2), "utf8").toString("base64");

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `Send DM from ${fromUserId} to ${toUserId}`,
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
          error: "Failed to save DM",
          status: putRes.status,
          detail: errText.slice(0, 500),
        }),
      };
    }

    console.log(`✓ DM sent: ${fromUserId} → ${toUserId}`);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, dm: dmData }),
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