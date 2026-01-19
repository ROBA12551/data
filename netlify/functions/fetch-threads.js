exports.handler = async (event) => {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${process.env.VITE_GITHUB_OWNER}/${process.env.VITE_GITHUB_REPO}/contents/threads.json`,
            {
                headers: {
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3.raw'
                }
            }
        );

        if (!response.ok) {
            return {
                statusCode: 200,
                body: JSON.stringify({ threads: [], qa: [] })
            };
        }

        const data = await response.text();
        const threads = data ? JSON.parse(data) : [];

        // スレッド（24時間以上経過）を除外
        const now = Date.now();
        const activeThreads = threads.filter(t => {
            if (t.type === 'thread') {
                return (now - new Date(t.createdAt).getTime()) < (24 * 60 * 60 * 1000);
            }
            return true;
        });

        const threadsList = activeThreads.filter(t => t.type === 'thread');
        const qaList = activeThreads.filter(t => t.type === 'qa');

        return {
            statusCode: 200,
            body: JSON.stringify({ threads: threadsList, qa: qaList })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};