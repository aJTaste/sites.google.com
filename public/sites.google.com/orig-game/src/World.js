// src/World.js
import { Chunk } from './Chunk.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        // HTML側で読み込んでいるSimplexNoiseを使用
        this.simplex = new window.SimplexNoise();
        this.chunks = new Map();
        
        this.chunkWidth = 16;
        this.chunkDepth = 16;
        this.renderDistance = 3; // プレイヤーの周囲何チャンクを描画するか
    }

    update(cameraPosition) {
        // カメラ（プレイヤー）が現在どのチャンクにいるかを計算
        const currentChunkX = Math.floor(cameraPosition.x / this.chunkWidth);
        const currentChunkZ = Math.floor(cameraPosition.z / this.chunkDepth);

        const activeChunks = new Set();

        // 描画範囲内のチャンクをループ
        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                // 円形にカリングして角の描画を省き、負荷を軽減
                if (x * x + z * z > this.renderDistance * this.renderDistance) continue;

                const cx = currentChunkX + x;
                const cz = currentChunkZ + z;
                const key = `${cx},${cz}`;
                activeChunks.add(key);

                if (!this.chunks.has(key)) {
                    // 新しいチャンクを生成
                    const newChunk = new Chunk(cx, cz, this.scene, this.simplex);
                    this.chunks.set(key, newChunk);
                }
            }
        }

        // 描画範囲外になったチャンクを破棄してメモリ解放
        for (const [key, chunk] of this.chunks.entries()) {
            if (!activeChunks.has(key)) {
                chunk.dispose();
                this.chunks.delete(key);
            }
        }
        
        // デバッグUIの更新
        document.getElementById('chunk-display').innerText = `Chunk: ${currentChunkX}, ${currentChunkZ}`;
    }
}