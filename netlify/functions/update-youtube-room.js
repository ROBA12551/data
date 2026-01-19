exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { roomId, action, data } = JSON.parse(event.body || "{}");

    if (!roomId || !action) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields" }),
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

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/youtube-rooms.json`;

    // ✅ sha + contentを取る
    const metaRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "netlify-function",
      },
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text().catch(() => "");
      return {
        statusCode: metaRes.status === 404 ? 404 : 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Rooms file not found or GitHub API error", status: metaRes.status, detail: errText.slice(0, 500) }),
      };
    }

    const meta = await metaRes.json(); // { sha, content(base64), ... }
    const sha = meta.sha;

    const decoded = meta.content
      ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
      : "[]";

    const rooms = decoded ? JSON.parse(decoded) : [];

    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Room not found" }),
      };
    }

    // ✅ 安全に初期化
    if (!Array.isArray(room.messages)) room.messages = [];
    if (!Array.isArray(room.queue)) room.queue = [];
    if (!Array.isArray(room.participants)) room.participants = [];
    if (typeof room.currentTime !== "number") room.currentTime = 0;

    // アクション別処理
    switch (action) {
      case "add-message": {
        if (!data || !data.message || !data.userName) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Message and userName required" }),
          };
        }
        room.messages.push({
          userName: data.userName,
          content: data.message,
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case "add-queue": {
        if (!data || !data.videoId || !data.title || !data.addedBy) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "VideoId, title, addedBy required" }),
          };
        }
        room.queue.push({
          videoId: data.videoId,
          title: data.title,
          addedBy: data.addedBy,
          addedAt: new Date().toISOString(),
        });
        break;
      }

      case "update-queue": {
        if (!data || !Array.isArray(data.queue)) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Queue array required" }),
          };
        }
        room.queue = data.queue;
        break;
      }

      case "add-participant": {
        if (!data || !data.participantName) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "ParticipantName required" }),
          };
        }
        if (!room.participants.includes(data.participantName)) {
          room.participants.push(data.participantName);
        }
        break;
      }

      case "remove-participant": {
        if (!data || !data.participantName) {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "ParticipantName required" }),
          };
        }
        room.participants = room.participants.filter((p) => p !== data.participantName);
        break;
      }

      case "update-current-time": {
        if (!data || typeof data.currentTime !== "number") {
          return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "CurrentTime number required" }),
          };
        }
        room.currentTime = data.currentTime;
        break;
      }

      default:
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Invalid action" }),
        };
    }

    const newContentB64 = Buffer.from(JSON.stringify(rooms, null, 2), "utf8").toString("base64");

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
        message: `Update YouTube room ${roomId}: ${action}`,
        content: newContentB64,
        sha,
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to update room", status: putRes.status, detail: errText.slice(0, 500) }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, room, action }),
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
