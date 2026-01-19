exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { question, category, userName } = JSON.parse(event.body || "{}");

    if (!question || !category) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    if (question.length > 500) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Question exceeds 500 characters" }),
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

    const qaData = {
      id: `qa_${Date.now()}`,
      question,
      category,
      askedBy: userName || "Anonymous",
      askedAt: new Date().toISOString(),
      answers: [],
      bestAnswerId: null,
      views: 0,
      helpful: 0,
    };

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/qa.json`;

    // qa.json を取得
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    let qaList = [];
    let sha = undefined;

    if (getRes.ok) {
      const meta = await getRes.json();
      sha = meta.sha;
      const decoded = meta.content
        ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
        : "[]";
      qaList = decoded ? JSON.parse(decoded) : [];
    } else if (getRes.status === 404) {
      // ファイルが存在しない → 自動作成
      qaList = [];
      sha = undefined;
    } else {
      const errText = await getRes.text().catch(() => "");
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "GitHub API error",
          status: getRes.status,
          detail: errText.slice(0, 500),
        }),
      };
    }

    qaList.unshift(qaData);

    const newContentB64 = Buffer.from(JSON.stringify(qaList, null, 2), "utf8").toString("base64");

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `Create Q&A: ${String(question).substring(0, 50)}`,
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
          error: "Failed to save Q&A",
          status: putRes.status,
          detail: errText.slice(0, 500),
        }),
      };
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, qa: qaData }),
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