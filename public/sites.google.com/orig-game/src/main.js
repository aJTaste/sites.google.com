// src/main.js
import { World } from './World.js';

// --- 初期化 ---
const container = document.getElementById('game-container');
const scene = new THREE.Scene();

const skyColor = new THREE.Color(0x87CEEB);
scene.background = skyColor;
// ブロックがパッと現れるのを隠すための霧
scene.fog = new THREE.Fog(skyColor, 20, 60);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
// 初期位置（上空）
camera.position.set(0, 40, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false }); // マイクラ感を出すためアンチエイリアス無効
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// パキッとした影や色合いを出す設定
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

// --- ライティング ---
// 全体的な明るさ
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// 太陽光（斜め上から）
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(50, 100, 30);
scene.add(sunLight);

// --- ワールド生成 ---
const world = new World(scene);

// ウィンドウリサイズ対応
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- ゲームループ ---
const posDisplay = document.getElementById('pos-display');
let angle = 0;

function animate() {
    requestAnimationFrame(animate);
    
    // フェーズ2のテスト：カメラを円を描くように自動で飛ばして地形を確認する
    angle += 0.005;
    camera.position.x = Math.cos(angle) * 30;
    camera.position.z = Math.sin(angle) * 30;
    camera.lookAt(camera.position.x + Math.cos(angle + 0.1), 20, camera.position.z + Math.sin(angle + 0.1));

    // ワールド（チャンク）の更新
    world.update(camera.position);

    // デバッグ座標の更新
    posDisplay.innerText = `XYZ: ${camera.position.x.toFixed(1)} / ${camera.position.y.toFixed(1)} / ${camera.position.z.toFixed(1)}`;

    renderer.render(scene, camera);
}

animate();