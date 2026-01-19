exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { qaId, answer, answeredBy } = JSON.parse(event.body || "{}");

    if (!qaId || !answer) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    if (answer.length > 1000) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Answer exceeds 1000 characters" }),
      };
    }

    const owner = process.env.VITE_GITHUB_OWNER;
    const repo = process.env.VITE_GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing env vars" }),
      };
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/qa.json`;

    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!getRes.ok) {
      return {
        statusCode: getRes.status === 404 ? 404 : 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "QA file not found or GitHub API error" }),
      };
    }

    const meta = await getRes.json();
    const decoded = meta.content
      ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
      : "[]";
    const qaList = decoded ? JSON.parse(decoded) : [];

    const qa = qaList.find((q) => q.id === qaId);
    if (!qa) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "QA not found" }),
      };
    }

    if (!Array.isArray(qa.answers)) qa.answers = [];

    const answerObj = {
      id: `ans_${Date.now()}`,
      answer,
      answeredBy: answeredBy || "Anonymous",
      answeredAt: new Date().toISOString(),
      helpful: 0,
    };

    qa.answers.push(answerObj);

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
        message: `Add answer to Q&A: ${qaId}`,
        content: newContentB64,
        sha: meta.sha,
        branch: "main",
      }),
    });

    if (!putRes.ok) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to add answer" }),
      };
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        answer: answerObj,
        answerCount: qa.answers.length,
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