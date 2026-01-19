exports.handler = async (event) => {
    const { title, videoId } = JSON.parse(event.body);

    if (!title || !videoId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields' })
        };
    }

    const roomData = {
        id: `yt_${Date.now()}`,
        title: title,
        videoId: videoId,
        createdAt: new Date().toISOString(),
        participants: [],
        messages: [],
        currentTime: 0
    };

    try {
        const response = await fetch(
            `https://api.github.com/repos/${process.env.VITE_GITHUB_OWNER}/${process.env.VITE_GITHUB_REPO}/contents/youtube-rooms.json`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3.raw'
                }
            }
        );

        let rooms = [];
        let sha = null;
        if (response.ok) {
            const data = await response.text();
            rooms = data ? JSON.parse(data) : [];
            const metaResp = await response.json();
            sha = metaResp.sha;
        }

        rooms.push(roomData);

        await fetch(
            `https://api.github.com/repos/${process.env.VITE_GITHUB_OWNER}/${process.env.VITE_GITHUB_REPO}/contents/youtube-rooms.json`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Create YouTube room: ${title}`,
                    content: Buffer.from(JSON.stringify(rooms, null, 2)).toString('base64'),
                    sha: sha
                })
            }
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, room: roomData })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};