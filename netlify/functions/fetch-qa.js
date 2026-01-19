exports.handler = async (event) => {
  try {
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
      if (getRes.status === 404) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qa: [] }),
        };
      }
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to fetch QA" }),
      };
    }

    const meta = await getRes.json();
    const decoded = meta.content
      ? Buffer.from(meta.content.replace(/\n/g, ""), "base64").toString("utf8")
      : "[]";
    const qaList = decoded ? JSON.parse(decoded) : [];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qa: qaList }),
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