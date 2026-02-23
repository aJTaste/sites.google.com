// ==========================================
// Part 3: Rendering & Game Loop
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiBiomeName = document.getElementById('biomeName');
const uiTimeLog = document.getElementById('timeLog');
const uiEventLog = document.getElementById('eventLog');

function resize() {
    // レスポンシブ対応 (アスペクト比を保ちつつ画面にフィットさせる拡張も可能)
    canvas.width = 1280;
    canvas.height = 800;
}
window.addEventListener('resize', resize);
resize();

// 描画メインルーチン
function render() {
    // 画面の中心をプレイヤーの位置とするためのオフセット計算
    const viewTilesX = Math.ceil(canvas.width / Game.tileSize);
    const viewTilesY = Math.ceil(canvas.height / Game.tileSize);
    
    const startX = Math.floor(Game.player.x) - Math.floor(viewTilesX / 2);
    const startY = Math.floor(Game.player.y) - Math.floor(viewTilesY / 2);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 地形（チャンク）の描画
    let currentBiome = null;
    for (let y = -1; y <= viewTilesY + 1; y++) {
        for (let x = -1; x <= viewTilesX + 1; x++) {
            const worldX = startX + x;
            const worldY = startY + y;
            
            const biome = Game.getBiome(worldX, worldY);
            if (worldX === Math.floor(Game.player.x) && worldY === Math.floor(Game.player.y)) {
                currentBiome = biome.type; // 現在地のバイオームを取得
            }

            // スムーズなスクロールのためのオフセット
            const drawX = (worldX - Game.player.x + viewTilesX / 2) * Game.tileSize;
            const drawY = (worldY - Game.player.y + viewTilesY / 2) * Game.tileSize;

            ctx.fillStyle = biome.color;
            ctx.fillRect(drawX, drawY, Game.tileSize + 1, Game.tileSize + 1); // 隙間防止の+1
        }
    }

    // 2. プレイヤーの描画
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, Game.tileSize / 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 3. 動的ライティング（昼夜サイクル）のオーバーレイ描画
    const dayCycleLength = 2000; // サイクル長
    const cyclePos = (Game.time % dayCycleLength) / dayCycleLength;
    // 0 = 昼, 0.5 = 夜
    const darkness = Math.sin(cyclePos * Math.PI * 2) * 0.45 + 0.45; // 0.0 ~ 0.9

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(10, 10, 30, ${darkness})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // プレイヤーの周囲に光源（ランタン効果）を作る
    if (darkness > 0.3) {
        ctx.globalCompositeOperation = 'destination-out';
        const grad = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, 150
        );
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    ctx.globalCompositeOperation = 'source-over'; // リセット

    // UIの更新
    uiBiomeName.innerText = `Biome: ${currentBiome || 'Unknown'}`;
    const hours = Math.floor((cyclePos * 24 + 12) % 24).toString().padStart(2, '0');
    uiTimeLog.innerText = `World Time: ${hours}:00 (Tick: ${Game.time})`;
}

// ゲームループ
function loop() {
    Game.player.update();
    Game.time++;
    
    // 歴史イベントのチェック
    const event = DataGen.generateHistory(Game.time);
    if(event) {
        uiEventLog.innerHTML = `<span style="color: #FFD700">${event}</span><br>` + uiEventLog.innerHTML;
        // ログが長くなりすぎないように制限
        if (uiEventLog.innerHTML.length > 500) uiEventLog.innerHTML = uiEventLog.innerHTML.substring(0, 500);
    }

    render();
    requestAnimationFrame(loop);
}

// ゲーム起動
loop();