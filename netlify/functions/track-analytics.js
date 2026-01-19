exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { event: eventName, userId, data: eventData } = JSON.parse(event.body || "{}");

    if (!eventName || !userId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const validEvents = [
      "page_view",
      "post_created",
      "post_shared",
      "youtube_room_created",
      "youtube_room_joined",
      "youtube_message_sent",
      "thread_created",
      "thread_message_sent",
      "qa_created",
      "qa_answer_added",
    ];

    if (!validEvents.includes(eventName)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid event name" }),
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

    const analyticsData = {
      id: `event_${Date.now()}`,
      event: eventName,
      userId,
      data: eventData || {},
      timestamp: new Date().toISOString(),
      userAgent: (event.headers && (event.headers["user-agent"] || event.headers["User-Agent"])) || "Unknown",
    };

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/analytics.json`;

    // ✅ sha + contentを取る
    const metaRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "netlify-function",
      },
    });

    let events = [];
    let sha = undefined;

    if (metaRes.ok) {
      const meta = await metaRes.json();
      sha = meta.sha;

      const decoded = meta.content
        ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
        : "[]";

      events = decoded ? JSON.parse(decoded) : [];
    } else if (metaRes.status === 404) {
      // 新規作成
      events = [];
      sha = undefined;
    } else {
      const errText = await metaRes.text().catch(() => "");
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "GitHub API error (GET analytics)", status: metaRes.status, detail: errText.slice(0, 500) }),
      };
    }

    events.unshift(analyticsData);

    // 最新10000件のみ保存
    if (events.length > 10000) events = events.slice(0, 10000);

    const newContentB64 = Buffer.from(JSON.stringify(events, null, 2), "utf8").toString("base64");

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "netlify-function",
      },
      body: JSON.stringify({
        message: `Track event: ${eventName}`,
        content: newContentB64,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to track event", status: putRes.status, detail: errText.slice(0, 500) }),
      };
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, eventId: analyticsData.id }),
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
