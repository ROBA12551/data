exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { threadId, message, userName } = JSON.parse(event.body || "{}");

    if (!threadId || !message) {
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
          error: "Missing env vars (VITE_GITHUB_OWNER / VITE_GITHUB_REPO / GITHUB_TOKEN)",
        }),
      };
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/threads.json`;

    // ✅ sha と content を取る（raw で取らない）
    const metaRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!metaRes.ok) {
      return {
        statusCode: metaRes.status === 404 ? 404 : 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Threads file not found or GitHub API error",
          status: metaRes.status,
        }),
      };
    }

    const meta = await metaRes.json(); // { sha, content(base64), ... }

    const decoded = meta.content
      ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
      : "[]";

    const threads = decoded ? JSON.parse(decoded) : [];

    const thread = threads.find((t) => t.id === threadId);
    if (!thread) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Thread not found" }),
      };
    }

    if (!Array.isArray(thread.messages)) thread.messages = [];

    const messageObj = {
      id: `msg_${Date.now()}`,
      userName: userName || "Anonymous",
      content: message,
      createdAt: new Date().toISOString(),
    };

    thread.messages.push(messageObj);

    const newContentB64 = Buffer.from(JSON.stringify(threads, null, 2), "utf8").toString("base64");

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `Add message to thread ${threadId}`,
        content: newContentB64,
        sha: meta.sha, // ✅ 正しい sha
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Failed to add message",
          status: putRes.status,
          detail: errText.slice(0, 500),
        }),
      };
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: messageObj,
        threadMessageCount: thread.messages.length,
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
