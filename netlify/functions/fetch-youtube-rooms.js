exports.handler = async () => {
  try {
    const owner = process.env.VITE_GITHUB_OWNER;
    const repo = process.env.VITE_GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !token) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: [], count: 0, lastUpdated: new Date().toISOString() }),
      };
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/posts.json`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3.raw",
          "User-Agent": "netlify-function",
        },
      }
    );

    if (!res.ok) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: [], count: 0, lastUpdated: new Date().toISOString() }),
      };
    }

    const text = await res.text();
    const posts = text ? JSON.parse(text) : [];

    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts, count: posts.length, lastUpdated: new Date().toISOString() }),
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
