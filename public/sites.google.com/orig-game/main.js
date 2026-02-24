// ==========================================
// 第5回(最終回): PolyGlide - 最終完成版
// ==========================================

const simplex = new SimplexNoise();

function getElevation(x, z) {
    let elevation = 0;
    let frequency = 0.015;
    let amplitude = 25;
    let persistence = 0.5;
    let lacunarity = 2.0;

    for (let i = 0; i < 4; i++) {
        elevation += simplex.noise2D(x * frequency, z * frequency) * amplitude;
        frequency *= lacunarity;
        amplitude *= persistence;
    }
    return elevation;
}

// --- Three.jsの基本セットアップ ---
const container = document.getElementById('game-container');
const scene = new THREE.Scene();

// 背景色（後で高度によって動的に変えます）
const lowAltColor = new THREE.Color(0x05050c);
const highAltColor = new THREE.Color(0x1a0b2e); // 高度が高い時の宇宙のような色

scene.background = lowAltColor.clone();
scene.fog = new THREE.Fog(scene.background, 50, 400);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// --- ライティング ---
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

const dirLight = new THREE.DirectionalLight(0x50e3c2, 0.8);
dirLight.position.set(100, 200, 50);
scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0x4a90e2, 0.5);
backLight.position.set(-100, 100, -50);
scene.add(backLight);

// ==========================================
// --- ゲーム管理（スコア等） ---
// ==========================================
let gameScore = 0;

// スコアUIの動的追加
const hud = document.getElementById('hud');
const scorePanel = document.createElement('div');
scorePanel.className = 'hud-panel';
scorePanel.style.bottom = '30px';
scorePanel.style.left = '50%';
scorePanel.style.transform = 'translateX(-50%)';
scorePanel.style.color = '#f5a623';
scorePanel.innerHTML = `SCORE: <span id="score-display">0</span>`;
hud.appendChild(scorePanel);

const scoreDisplay = document.getElementById('score-display');

// ==========================================
// --- チャンク＆アイテム生成システム ---
// ==========================================
const CHUNK_SIZE = 200;
const CHUNK_SEGMENTS = 40;
const VIEW_RADIUS = 2;

// リングの共通ジオメトリとマテリアル（メモリ節約のため使い回す）
const ringGeo = new THREE.TorusGeometry(8, 0.5, 8, 24);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xf5a623, transparent: true, opacity: 0.8 });

class TerrainChunk {
    constructor(chunkX, chunkZ, scene) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.scene = scene;
        this.rings = []; // このチャンク内のリング
        this.generate();
    }
    
    generate() {
        const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
        geometry.rotateX(-Math.PI / 2);
        const posAttr = geometry.attributes.position;
        const v = new THREE.Vector3();
        const offsetX = this.chunkX * CHUNK_SIZE;
        const offsetZ = this.chunkZ * CHUNK_SIZE;

        for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i);
            posAttr.setY(i, getElevation(v.x + offsetX, v.z + offsetZ));
        }
        geometry.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.8, flatShading: true });
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x50e3c2, wireframe: true, transparent: true, opacity: 0.1 });

        this.mesh = new THREE.Mesh(geometry, mat);
        this.wireframe = new THREE.Mesh(geometry, wireMat);
        this.mesh.position.set(offsetX, 0, offsetZ);
        this.mesh.add(this.wireframe);
        this.scene.add(this.mesh);

        // --- リング（アイテム）のランダム生成 ---
        if (Math.random() > 0.3) { // 70%の確率でチャンクにリングを生成
            const ringCount = Math.floor(Math.random() * 3) + 1; // 1〜3個
            for(let i=0; i<ringCount; i++) {
                const rx = offsetX + (Math.random() - 0.5) * CHUNK_SIZE;
                const rz = offsetZ + (Math.random() - 0.5) * CHUNK_SIZE;
                const ry = getElevation(rx, rz) + 20 + Math.random() * 50; // 地面から少し浮かす
                
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.position.set(rx, ry, rz);
                ring.rotation.y = Math.random() * Math.PI; // ランダムな向き
                this.scene.add(ring);
                this.rings.push({ mesh: ring, collected: false });
            }
        }
    }
    
    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.wireframe.material.dispose();
        
        // リングのクリーンアップ
        this.rings.forEach(r => {
            this.scene.remove(r.mesh);
        });
    }
}

class ChunkManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
    }
    
    update(position) {
        const cx = Math.round(position.x / CHUNK_SIZE);
        const cz = Math.round(position.z / CHUNK_SIZE);
        const active = new Set();

        for (let x = -VIEW_RADIUS; x <= VIEW_RADIUS; x++) {
            for (let z = -VIEW_RADIUS; z <= VIEW_RADIUS; z++) {
                const key = `${cx + x},${cz + z}`;
                active.add(key);
                if (!this.chunks.has(key)) this.chunks.set(key, new TerrainChunk(cx + x, cz + z, this.scene));
            }
        }
        for (const [key, chunk] of this.chunks.entries()) {
            if (!active.has(key)) {
                chunk.dispose();
                this.chunks.delete(key);
            }
        }
    }

    // 全てのチャンクのリングとプレイヤーの当たり判定をチェック
    checkCollisions(playerPos) {
        for (const chunk of this.chunks.values()) {
            for (const ring of chunk.rings) {
                if (!ring.collected) {
                    ring.mesh.rotation.y += 0.02; // リングを回転させるアニメーション
                    
                    const dist = playerPos.distanceTo(ring.mesh.position);
                    if (dist < 12) { // 当たり判定の半径
                        ring.collected = true;
                        this.scene.remove(ring.mesh);
                        return true; // ヒットした
                    }
                }
            }
        }
        return false;
    }
}
const chunkManager = new ChunkManager(scene);

// ==========================================
// --- プレイヤー ---
// ==========================================
class Player {
    constructor(scene) {
        const geometry = new THREE.ConeGeometry(2, 6, 3);
        geometry.rotateX(Math.PI / 2);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff, roughness: 0.2, metalness: 0.8, flatShading: true
        });
        this.mesh = new THREE.Mesh(geometry, material);
        scene.add(this.mesh);

        this.position = new THREE.Vector3(0, 150, 0);
        this.speed = 1.5;
        this.pitch = 0;
        this.roll = 0;
        this.yaw = 0;
        this.boostTimer = 0; // スピードブースト用

        this.keys = { w: false, a: false, s: false, d: false };
        this.mouseX = 0;
        this.mouseY = 0;

        window.addEventListener('keydown', (e) => this.onKey(e.key, true));
        window.addEventListener('keyup', (e) => this.onKey(e.key, false));
        window.addEventListener('mousemove', (e) => {
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        });
    }

    onKey(key, isDown) {
        key = key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) this.keys[key] = isDown;
    }

    update() {
        const pitchInput = (this.keys.w ? -1 : (this.keys.s ? 1 : this.mouseY));
        const rollInput = (this.keys.a ? -1 : (this.keys.d ? 1 : -this.mouseX));

        this.pitch += pitchInput * 0.02;
        this.roll += rollInput * 0.03;

        this.pitch *= 0.95;
        this.roll *= 0.95;

        this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));
        this.roll = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.roll));
        this.yaw -= this.roll * 0.03;

        this.mesh.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');

        // ブースト処理
        if (this.boostTimer > 0) {
            this.speed += 0.2; // 急加速
            this.boostTimer--;
        }

        this.speed -= this.pitch * 0.05;
        this.speed -= 0.002; 
        
        // 最高速度の制御（ブースト中は上限引き上げ）
        const maxSpeed = this.boostTimer > 0 ? 6.0 : 4.0;
        this.speed = Math.max(0.5, Math.min(maxSpeed, this.speed));

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyEuler(this.mesh.rotation);
        this.position.add(direction.multiplyScalar(this.speed));

        const groundHeight = getElevation(this.position.x, this.position.z);
        if (this.position.y < groundHeight + 2) {
            this.position.y = groundHeight + 2;
            this.pitch = 0.5;
            this.speed *= 0.7;
            
            // 地面に当たったらスコアペナルティ
            if (gameScore > 0) {
                gameScore = Math.max(0, gameScore - 10);
                scoreDisplay.innerText = gameScore;
                scorePanel.style.color = '#ff4a4a';
                setTimeout(() => scorePanel.style.color = '#f5a623', 500);
            }
        }

        this.mesh.position.copy(this.position);
    }

    applyBoost() {
        this.boostTimer = 30; // 30フレーム分のブースト
    }
}

const player = new Player(scene);

// --- UI制御とゲームループ ---
const startBtn = document.getElementById('start-btn');
const menuScreen = document.getElementById('menu-screen');
const altDisplay = document.getElementById('altitude-display');
const spdDisplay = document.getElementById('speed-display');
let isPlaying = false;

startBtn.addEventListener('click', () => {
    menuScreen.style.opacity = '0';
    setTimeout(() => {
        menuScreen.style.display = 'none';
        hud.classList.remove('hidden');
        isPlaying = true;
    }, 500);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);

    if (isPlaying) {
        player.update();
        chunkManager.update(player.position);

        // --- リングとの当たり判定 ---
        if (chunkManager.checkCollisions(player.position)) {
            gameScore += 100;
            scoreDisplay.innerText = gameScore;
            player.applyBoost();
            
            // スコアUIのアニメーション
            scorePanel.style.transform = 'translateX(-50%) scale(1.2)';
            setTimeout(() => scorePanel.style.transform = 'translateX(-50%) scale(1)', 200);
        }

        // --- 高度に応じた環境光・空の色の変化 ---
        // 高度 100m 〜 400m の間で背景色を暗く（宇宙に近づくように）ブレンド
        const altRatio = Math.max(0, Math.min(1, (player.position.y - 100) / 300));
        scene.background.lerpColors(lowAltColor, highAltColor, altRatio);
        scene.fog.color.copy(scene.background);

        // --- カメラ追従 ---
        const offset = new THREE.Vector3(0, 8, 25);
        offset.applyEuler(new THREE.Euler(0, player.yaw, 0));
        offset.add(player.position);
        
        // スピードが速い時はカメラを少し引き気味にする演出
        const speedFov = 60 + (player.speed * 2);
        camera.fov += (speedFov - camera.fov) * 0.1;
        camera.updateProjectionMatrix();

        camera.position.lerp(offset, 0.1);
        camera.lookAt(player.position);

        // --- HUD更新 ---
        const groundY = getElevation(player.position.x, player.position.z);
        const altitude = Math.max(0, player.position.y - groundY);
        altDisplay.innerText = `ALT: ${Math.floor(altitude * 10)}m`;
        spdDisplay.innerText = `SPD: ${Math.floor(player.speed * 120)}km/h`;
    }

    renderer.render(scene, camera);
}

chunkManager.update(player.position);
animate();