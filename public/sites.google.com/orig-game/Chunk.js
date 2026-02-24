// src/Chunk.js
export class Chunk {
    constructor(chunkX, chunkZ, scene, simplex) {
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.scene = scene;
        this.simplex = simplex;

        // チャンクのサイズ設定
        this.width = 16;
        this.height = 32;
        this.depth = 16;

        // ブロックデータ (0: 空気, 1: 草, 2: 土, 3: 石)
        // 1次元配列で3Dデータを管理（メモリ効率重視）
        this.blocks = new Uint8Array(this.width * this.height * this.depth);
        
        this.mesh = null;
        this.generateData();
        this.buildMesh();
    }

    // 3D座標から1次元配列のインデックスを取得
    getIndex(x, y, z) {
        return x + this.width * (y + this.height * z);
    }

    // ブロックの種類を取得（範囲外は空気扱い）
    getBlock(x, y, z) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.depth) {
            return 0; // チャンク外はとりあえず空気として扱い、端のブロックを描画させる
        }
        return this.blocks[this.getIndex(x, y, z)];
    }

    // ノイズを使って地形データを生成
    generateData() {
        const offsetX = this.chunkX * this.width;
        const offsetZ = this.chunkZ * this.depth;

        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                // 絶対座標でノイズを取得し、なだらかな地形を作る
                const worldX = offsetX + x;
                const worldZ = offsetZ + z;
                
                // 複数のノイズを重ねて自然な起伏に
                let noise = this.simplex.noise2D(worldX * 0.02, worldZ * 0.02) * 10;
                noise += this.simplex.noise2D(worldX * 0.05, worldZ * 0.05) * 4;
                
                const groundHeight = Math.floor(this.height / 2 + noise);

                for (let y = 0; y < this.height; y++) {
                    const index = this.getIndex(x, y, z);
                    if (y > groundHeight) {
                        this.blocks[index] = 0; // 空気
                    } else if (y === groundHeight) {
                        this.blocks[index] = 1; // 表面は草
                    } else if (y > groundHeight - 4) {
                        this.blocks[index] = 2; // 少し下は土
                    } else {
                        this.blocks[index] = 3; // 深いところは石
                    }
                }
            }
        }
    }

    // 表面にあるブロックだけをInstancedMeshとして構築
    buildMesh() {
        const visibleBlocks = [];

        // 表面カリング: 6方向のどれかが空気(0)なら描画対象にする
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                for (let z = 0; z < this.depth; z++) {
                    const blockType = this.getBlock(x, y, z);
                    if (blockType !== 0) {
                        if (
                            this.getBlock(x + 1, y, z) === 0 ||
                            this.getBlock(x - 1, y, z) === 0 ||
                            this.getBlock(x, y + 1, z) === 0 ||
                            this.getBlock(x, y - 1, z) === 0 ||
                            this.getBlock(x, y, z + 1) === 0 ||
                            this.getBlock(x, y, z - 1) === 0
                        ) {
                            visibleBlocks.push({ x, y, z, type: blockType });
                        }
                    }
                }
            }
        }

        if (visibleBlocks.length === 0) return;

        // 1つの基本ブロックジオメトリを大量に使い回す (InstancedMesh)
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ vertexColors: true });
        
        this.mesh = new THREE.InstancedMesh(geometry, material, visibleBlocks.length);
        
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        // 各ブロックの色設定
        const colors = {
            1: 0x55aa55, // 草 (緑)
            2: 0x885533, // 土 (茶色)
            3: 0x888888  // 石 (グレー)
        };

        // 抽出した表面ブロックを配置
        visibleBlocks.forEach((block, i) => {
            // ローカル座標からワールド座標へ
            dummy.position.set(
                block.x + this.chunkX * this.width,
                block.y,
                block.z + this.chunkZ * this.depth
            );
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);

            color.setHex(colors[block.type] || 0xffffff);
            this.mesh.setColorAt(i, color);
        });

        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
        
        // チャンク同士の隙間を消すための影の微調整
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        this.scene.add(this.mesh);
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.dispose();
        }
    }
}