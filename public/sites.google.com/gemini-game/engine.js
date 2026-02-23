// ==========================================
// Part 1: Core Engine & Infinite Generation
// ==========================================

// 高速な擬似乱数ジェネレータと2Dノイズエンジン
class NoiseEngine {
    constructor(seed = 12345) {
        this.seed = seed;
    }
    
    // 座標に基づくハッシュ関数
    hash(x, y) {
        let n = x * 13 + y * 57 + this.seed;
        n = (n << 13) ^ n;
        return (1.0 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824.0);
    }

    // スムーズな補間
    lerp(a, b, t) {
        return a + t * (b - a);
    }

    // 2Dバリューノイズの取得
    getNoise(x, y) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;

        const v1 = this.hash(ix, iy);
        const v2 = this.hash(ix + 1, iy);
        const v3 = this.hash(ix, iy + 1);
        const v4 = this.hash(ix + 1, iy + 1);

        const i1 = this.lerp(v1, v2, fx);
        const i2 = this.lerp(v3, v4, fx);
        return this.lerp(i1, i2, fy);
    }

    // フラクタルブラウン運動 (fBm) による複雑な地形生成
    getFBM(x, y, octaves = 4) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        for(let i = 0; i < octaves; i++) {
            total += this.getNoise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
        }
        return total / maxValue;
    }
}

// プレイヤークラス（独自の物理・移動ロジック拡張用）
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speed = 0.1; // タイル単位の速度
        this.keys = {};
        
        window.addEventListener('keydown', e => this.keys[e.key] = true);
        window.addEventListener('keyup', e => this.keys[e.key] = false);
    }

    update() {
        if (this.keys['ArrowUp'] || this.keys['w']) this.y -= this.speed;
        if (this.keys['ArrowDown'] || this.keys['s']) this.y += this.speed;
        if (this.keys['ArrowLeft'] || this.keys['a']) this.x -= this.speed;
        if (this.keys['ArrowRight'] || this.keys['d']) this.x += this.speed;
    }
}

// ゲームステート管理
const Game = {
    noise: new NoiseEngine(Math.random() * 10000),
    player: new Player(0, 0),
    time: 0, // ゲーム内時間
    tileSize: 32, // 1タイルのピクセル数
    
    // ノイズ値からバイオーム（地形）を判定
    getBiome(x, y) {
        const height = this.noise.getFBM(x * 0.05, y * 0.05);
        if (height < -0.3) return { type: 'DeepWater', color: '#1E3F66', walkable: false };
        if (height < -0.1) return { type: 'Water', color: '#2E5984', walkable: false };
        if (height < 0.0) return { type: 'Sand', color: '#E2C792', walkable: true };
        if (height < 0.3) return { type: 'Grass', color: '#4B7B32', walkable: true };
        if (height < 0.5) return { type: 'Forest', color: '#2A4B1A', walkable: true };
        if (height < 0.7) return { type: 'Mountain', color: '#7D7D7D', walkable: true };
        return { type: 'Snow', color: '#FFFFFF', walkable: true };
    }
};