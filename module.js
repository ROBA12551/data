/**
 * PulseNote Core Module
 * Handles algorithmic feed generation, impressions, analytics, and engagement
 */

class PulseNoteAlgorithm {
    constructor() {
        this.posts = [];
        this.userImpressions = new Map();
        this.userEngagements = new Map();
        this.feedCache = new Map();
        this.algorithm = 'hybrid'; // 'chronological', 'engagement', 'hybrid'
        this.config = {
            impressionDecayFactor: 0.95, // 時間による減衰
            engagementWeight: 0.6,
            recencyWeight: 0.3,
            diversityWeight: 0.1,
            minImpressionThreshold: 10,
            maxFeedSize: 50,
            impressionCacheTTL: 3600000 // 1 hour
        };
    }

    /**
     * ユーザーのセッションIDを取得または生成
     */
    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('pulsenote_session_id');
        if (!sessionId) {
            sessionId = this.generateSessionId();
            sessionStorage.setItem('pulsenote_session_id', sessionId);
        }
        return sessionId;
    }

    /**
     * セッションIDを生成
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * インプレッションを記録
     * @param {string} postId - 投稿ID
     * @param {string} userId - ユーザーセッションID
     * @param {object} metadata - メタデータ (viewDuration, scrollDepth など)
     */
    recordImpression(postId, userId, metadata = {}) {
        const impressionKey = `${postId}_${userId}`;
        
        const impression = {
            postId,
            userId,
            timestamp: Date.now(),
            viewDuration: metadata.viewDuration || 0,
            scrollDepth: metadata.scrollDepth || 0,
            inViewport: metadata.inViewport !== false,
            deviceType: this.getDeviceType(),
            ...metadata
        };

        if (!this.userImpressions.has(userId)) {
            this.userImpressions.set(userId, []);
        }

        this.userImpressions.get(userId).push(impression);
        
        // GitHub に記録（非同期）
        this.persistImpression(impression).catch(err => 
            console.error('Failed to persist impression:', err)
        );

        return impression;
    }

    /**
     * インプレッションをGitHubに永続化
     */
    async persistImpression(impression) {
        try {
            const response = await fetch('/.netlify/functions/record-impression', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(impression)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('Impression persistence failed:', err);
            throw err;
        }
    }

    /**
     * エンゲージメントを記録
     */
    recordEngagement(postId, userId, engagementType, metadata = {}) {
        const engagement = {
            postId,
            userId,
            type: engagementType, // 'like', 'repost', 'reply', 'share'
            timestamp: Date.now(),
            ...metadata
        };

        if (!this.userEngagements.has(userId)) {
            this.userEngagements.set(userId, []);
        }

        this.userEngagements.get(userId).push(engagement);

        // GitHub に記録
        this.persistEngagement(engagement).catch(err =>
            console.error('Failed to persist engagement:', err)
        );

        return engagement;
    }

    /**
     * エンゲージメントをGitHubに永続化
     */
    async persistEngagement(engagement) {
        try {
            const response = await fetch('/.netlify/functions/record-engagement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(engagement)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (err) {
            console.error('Engagement persistence failed:', err);
            throw err;
        }
    }

    /**
     * ハイブリッドアルゴリズムでフィードを生成
     * @param {array} allPosts - 全投稿
     * @param {string} userId - ユーザーセッションID
     * @param {object} userPreferences - ユーザー設定
     */
    generateFeed(allPosts, userId, userPreferences = {}) {
        const cacheKey = `feed_${userId}`;
        
        // キャッシュを確認
        if (this.feedCache.has(cacheKey)) {
            const cached = this.feedCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.config.impressionCacheTTL) {
                return cached.feed;
            }
        }

        // スコアを計算
        const scoredPosts = allPosts.map(post => ({
            ...post,
            score: this.calculatePostScore(post, userId, userPreferences)
        }));

        // スコアでソート
        const rankedPosts = scoredPosts
            .sort((a, b) => b.score - a.score)
            .slice(0, this.config.maxFeedSize);

        // キャッシュに保存
        this.feedCache.set(cacheKey, {
            feed: rankedPosts,
            timestamp: Date.now()
        });

        return rankedPosts;
    }

    /**
     * 投稿のスコアを計算
     */
    calculatePostScore(post, userId, userPreferences = {}) {
        const engagementScore = this.calculateEngagementScore(post);
        const recencyScore = this.calculateRecencyScore(post);
        const diversityScore = this.calculateDiversityScore(post, userId);
        const impressionScore = this.calculateImpressionScore(post, userId);

        // ハイブリッド計算
        let finalScore = 
            (engagementScore * this.config.engagementWeight) +
            (recencyScore * this.config.recencyWeight) +
            (diversityScore * this.config.diversityWeight) +
            (impressionScore * 0.0); // インプレッションは参考情報

        // ユーザー設定を反映
        if (userPreferences.boostRecent) {
            finalScore *= 1.2;
        }

        return finalScore;
    }

    /**
     * エンゲージメントスコアを計算
     */
    calculateEngagementScore(post) {
        const likes = post.engagementCount?.likes || 0;
        const reposts = post.engagementCount?.reposts || 0;
        const replies = post.engagementCount?.replies || 0;

        // 加重平均
        return (
            (likes * 1.0) +
            (reposts * 2.0) +
            (replies * 3.0)
        ) / Math.max(1, (likes + reposts + replies));
    }

    /**
     * 新鮮さスコアを計算
     */
    calculateRecencyScore(post) {
        const ageInHours = (Date.now() - new Date(post.createdAt).getTime()) / 3600000;
        return Math.exp(-ageInHours / 24); // 24時間で半減
    }

    /**
     * 多様性スコアを計算（同じ作者の投稿を減らす）
     */
    calculateDiversityScore(post, userId) {
        const userPosts = this.userEngagements.get(userId) || [];
        const sameAuthorEngagements = userPosts.filter(e => e.postId.startsWith(post.anonymousId));
        
        // 同じ作者への繰り返しエンゲージメントを減らす
        return 1.0 / (1.0 + (sameAuthorEngagements.length * 0.1));
    }

    /**
     * インプレッションスコアを計算
     */
    calculateImpressionScore(post, userId) {
        const userImpressions = this.userImpressions.get(userId) || [];
        const postImpressions = userImpressions.filter(i => i.postId === post.id);

        // 既にインプレッションがある場合は、スコアを低下
        if (postImpressions.length > 0) {
            const lastImpression = postImpressions[postImpressions.length - 1];
            const timeSinceLastView = (Date.now() - lastImpression.timestamp) / 3600000;
            return Math.pow(this.config.impressionDecayFactor, postImpressions.length);
        }

        return 1.0;
    }

    /**
     * デバイスタイプを取得
     */
    getDeviceType() {
        const width = window.innerWidth;
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    }

    /**
     * トレンディングな投稿を取得
     */
    getTrendingPosts(allPosts, limit = 10) {
        const now = Date.now();
        
        return allPosts
            .map(post => ({
                ...post,
                trendScore: this.calculateTrendScore(post, now)
            }))
            .sort((a, b) => b.trendScore - a.trendScore)
            .slice(0, limit);
    }

    /**
     * トレンドスコアを計算
     */
    calculateTrendScore(post, now) {
        const ageInHours = (now - new Date(post.createdAt).getTime()) / 3600000;
        const engagementRate = (post.engagementCount?.likes || 0) / Math.max(1, post.impressionCount || 1);
        
        // 最近のエンゲージメント率を重視
        return engagementRate * Math.exp(-ageInHours / 6);
    }

    /**
     * 推奨投稿を取得（ユーザーの過去の行動に基づく）
     */
    getRecommendedPosts(allPosts, userId, limit = 10) {
        const userEngagements = this.userEngagements.get(userId) || [];
        
        if (userEngagements.length === 0) {
            // 新規ユーザー用：トレンディングな投稿
            return this.getTrendingPosts(allPosts, limit);
        }

        // ユーザーが過去にエンゲージメントした投稿のキーワードを抽出
        const engagedPostIds = userEngagements.map(e => e.postId);
        const engagedPosts = allPosts.filter(p => engagedPostIds.includes(p.id));

        // コンテンツベースのフィルタリング
        const recommended = allPosts.filter(post => 
            !engagedPostIds.includes(post.id) &&
            post.displayName !== engagedPosts[0]?.displayName // 同じ作者は除外
        );

        return recommended
            .slice(0, limit)
            .map(post => ({
                ...post,
                score: this.calculatePostScore(post, userId)
            }))
            .sort((a, b) => b.score - a.score);
    }

    /**
     * 投稿の人気度を計算
     */
    getPostPopularity(post) {
        const impressions = post.impressionCount || 1;
        const likes = post.engagementCount?.likes || 0;
        const reposts = post.engagementCount?.reposts || 0;
        const replies = post.engagementCount?.replies || 0;

        const engagementRate = (likes + reposts + replies) / impressions;
        
        if (engagementRate > 0.1) return 'viral';
        if (engagementRate > 0.05) return 'trending';
        if (engagementRate > 0.02) return 'popular';
        return 'normal';
    }

    /**
     * ユーザーの興味トピックを推定
     */
    inferUserInterests(userId, allPosts) {
        const userEngagements = this.userEngagements.get(userId) || [];
        const engagedPosts = allPosts.filter(p => 
            userEngagements.some(e => e.postId === p.id)
        );

        // 簡易的なキーワード抽出（実装例）
        const keywords = new Map();
        
        engagedPosts.forEach(post => {
            const words = post.content.toLowerCase().split(/\s+/);
            words.forEach(word => {
                if (word.length > 4) { // 短い単語は除外
                    keywords.set(word, (keywords.get(word) || 0) + 1);
                }
            });
        });

        return Array.from(keywords.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([keyword]) => keyword);
    }

    /**
     * A/Bテスト用：異なるアルゴリズムをテスト
     */
    testAlgorithmVariant(allPosts, userId, variant = 'control') {
        switch (variant) {
            case 'engagement_heavy':
                return allPosts
                    .sort((a, b) => 
                        this.calculateEngagementScore(b) - this.calculateEngagementScore(a)
                    )
                    .slice(0, this.config.maxFeedSize);
            
            case 'recency_heavy':
                return allPosts
                    .sort((a, b) => 
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                    .slice(0, this.config.maxFeedSize);
            
            case 'diversity_focus':
                return this.generateFeed(allPosts, userId, { boostRecent: true });
            
            default: // control
                return this.generateFeed(allPosts, userId);
        }
    }

    /**
     * キャッシュをクリア
     */
    clearCache(userId = null) {
        if (userId) {
            this.feedCache.delete(`feed_${userId}`);
        } else {
            this.feedCache.clear();
        }
    }

    /**
     * 統計情報を取得
     */
    getStatistics(userId) {
        const userImpressions = this.userImpressions.get(userId) || [];
        const userEngagements = this.userEngagements.get(userId) || [];

        return {
            totalImpressions: userImpressions.length,
            totalEngagements: userEngagements.length,
            engagementRate: userEngagements.length / Math.max(1, userImpressions.length),
            averageViewDuration: userImpressions.length > 0
                ? userImpressions.reduce((sum, i) => sum + (i.viewDuration || 0), 0) / userImpressions.length
                : 0,
            engagementBreakdown: {
                likes: userEngagements.filter(e => e.type === 'like').length,
                reposts: userEngagements.filter(e => e.type === 'repost').length,
                replies: userEngagements.filter(e => e.type === 'reply').length,
                shares: userEngagements.filter(e => e.type === 'share').length
            },
            deviceDistribution: {
                mobile: userImpressions.filter(i => i.deviceType === 'mobile').length,
                tablet: userImpressions.filter(i => i.deviceType === 'tablet').length,
                desktop: userImpressions.filter(i => i.deviceType === 'desktop').length
            }
        };
    }
}

// グローバルに公開
window.PulseNoteAlgorithm = PulseNoteAlgorithm;

// デフォルトインスタンスをエクスポート
const pulseNoteAlgorithm = new PulseNoteAlgorithm();
window.pulseNoteAlgorithm = pulseNoteAlgorithm;