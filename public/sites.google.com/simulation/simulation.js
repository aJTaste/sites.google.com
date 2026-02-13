import { CellType, Dir } from './types.js';
import { Vec2 } from './math.js';

export class Simulation {
    constructor(grid) {
        this.grid = grid;
        this.balls = []; // 物理オブジェクト
        this.gravity = new Vec2(0, 0.2);
        this.tickCounter = 0;
    }

    update() {
        this.updateLogic();
        this.updatePhysics();
        this.tickCounter++;
    }

    // --- 論理回路シミュレーション (セル・オートマトン的アプローチ) ---
    updateLogic() {
        // Step 1: 次の状態を計算
        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                const cell = this.grid.getCell(x, y);
                if (cell.type === CellType.EMPTY || cell.type === CellType.WALL) continue;

                // 入力があるかチェック
                const hasInput = this.checkInput(x, y, cell);
                
                // タイプごとの振る舞い
                switch (cell.type) {
                    case CellType.BATTERY:
                        cell.nextPowered = true;
                        break;
                    case CellType.WIRE:
                    case CellType.LAMP:
                    case CellType.PISTON:
                    case CellType.SPAWNER:
                        cell.nextPowered = hasInput;
                        break;
                    case CellType.NOT:
                        // 入力があればOFF、なければON（後ろからの入力のみ受け付ける）
                        const backInput = this.getInputFromDir(x, y, (cell.rotation + 2) % 4);
                        cell.nextPowered = !backInput;
                        break;
                    case CellType.DIODE:
                        const bInput = this.getInputFromDir(x, y, (cell.rotation + 2) % 4);
                        cell.nextPowered = bInput;
                        break;
                    case CellType.SENSOR:
                        // 物理更新側でセットされるが、ここでは状態維持
                        // reset is done manually or by timeout? 
                        // 今回は物理接触時のみTrueにするため、ここではFalseリセット
                        cell.nextPowered = false; 
                        break;
                }
            }
        }

        // Step 2: 状態を更新
        for (let i = 0; i < this.grid.cells.length; i++) {
            this.grid.cells[i].powered = this.grid.cells[i].nextPowered;
        }
        
        // Step 3: 機能実行 (スポナーなど)
        if (this.tickCounter % 10 === 0) { // 少し間隔を空ける
            for (let y = 0; y < this.grid.height; y++) {
                for (let x = 0; x < this.grid.width; x++) {
                    const cell = this.grid.getCell(x, y);
                    if (cell.powered && cell.type === CellType.SPAWNER) {
                        this.spawnBall(x, y, cell.rotation);
                    }
                }
            }
        }
    }

    // 周囲からの入力をチェック
    checkInput(x, y, selfCell) {
        const dirs = [
            { dx: 0, dy: -1 }, // UP
            { dx: 1, dy: 0 },  // RIGHT
            { dx: 0, dy: 1 },  // DOWN
            { dx: -1, dy: 0 }  // LEFT
        ];

        for (let i = 0; i < 4; i++) {
            if (selfCell.directional && i === selfCell.rotation) continue; // 出力方向からは受け取らない

            const neighbor = this.grid.getCell(x + dirs[i].dx, y + dirs[i].dy);
            if (!neighbor) continue;

            // 隣接セルが出力可能か
            if (neighbor.powered) {
                // ワイヤー同士はつながる
                if (neighbor.type === CellType.WIRE || neighbor.type === CellType.BATTERY || neighbor.type === CellType.SENSOR) return true;
                
                // 方向性のあるセルは、こちらを向いているかチェック
                if (neighbor.directional) {
                    if (neighbor.rotation === i) return true; // Neighbor is pointing at us (Wait, i is direction from Us to Neighbor. We need Neighbor pointing opposite)
                    // 修正: i=0(UP)の時、隣(上)はDOWN(2)を向いている必要がある
                    if (neighbor.rotation === (i + 2) % 4) return true;
                }
            }
        }
        return false;
    }

    // 特定方向からの入力取得
    getInputFromDir(x, y, dir) {
        const dx = [0, 1, 0, -1][dir];
        const dy = [-1, 0, 1, 0][dir];
        const neighbor = this.grid.getCell(x + dx, y + dy);
        if (!neighbor) return false;
        
        // 隣がこちらへ出力しているか
        if (neighbor.powered) {
             // ワイヤー等は全方位出力
             if (!neighbor.directional) return true;
             // 方向性がある場合
             if (neighbor.rotation === (dir + 2) % 4) return true;
        }
        return false;
    }

    // --- 物理シミュレーション ---
    updatePhysics() {
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            
            // 重力
            ball.vel = ball.vel.add(this.gravity);
            ball.pos = ball.pos.add(ball.vel);

            // 摩擦
            ball.vel = ball.vel.mult(0.99);

            // 画面外削除
            if (ball.pos.y > this.grid.height * this.grid.cellSize + 100) {
                this.balls.splice(i, 1);
                continue;
            }

            // グリッドとの衝突判定
            this.handleGridCollision(ball);
        }
    }

    handleGridCollision(ball) {
        const radius = ball.radius;
        // ボールの周囲のセルをチェック
        const gx = Math.floor(ball.pos.x / this.grid.cellSize);
        const gy = Math.floor(ball.pos.y / this.grid.cellSize);

        for (let y = gy - 1; y <= gy + 1; y++) {
            for (let x = gx - 1; x <= gx + 1; x++) {
                const cell = this.grid.getCell(x, y);
                if (!cell) continue;

                // 衝突対象: 壁、またはOFFのピストン以外の物体など
                // シンプルにするため、WIREなどは透過、WALLと機械類は衝突
                const solid = [CellType.WALL, CellType.BATTERY, CellType.LAMP, CellType.NOT, CellType.DIODE, CellType.PISTON, CellType.SPAWNER, CellType.SENSOR].includes(cell.type);
                
                if (solid) {
                    const cellRect = {
                        x: x * this.grid.cellSize,
                        y: y * this.grid.cellSize,
                        w: this.grid.cellSize,
                        h: this.grid.cellSize
                    };

                    // AABB vs Circle 簡易判定
                    const closestX = Math.max(cellRect.x, Math.min(ball.pos.x, cellRect.x + cellRect.w));
                    const closestY = Math.max(cellRect.y, Math.min(ball.pos.y, cellRect.y + cellRect.h));
                    
                    const dx = ball.pos.x - closestX;
                    const dy = ball.pos.y - closestY;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < radius) {
                        // 衝突解決（押し出し）
                        const overlap = radius - distance;
                        const normal = distance === 0 ? new Vec2(0, -1) : new Vec2(dx, dy).normalize();
                        
                        ball.pos = ball.pos.add(normal.mult(overlap));
                        
                        // 反射
                        // ピストンがONなら強く弾く
                        let bounceForce = 0.6;
                        if (cell.type === CellType.PISTON && cell.powered) {
                            bounceForce = 1.5; // 加速
                        }

                        // ベクトル反射公式: v' = v - 2(v.n)n
                        const dot = ball.vel.x * normal.x + ball.vel.y * normal.y;
                        ball.vel = ball.vel.sub(normal.mult(2 * dot));
                        ball.vel = ball.vel.mult(bounceForce);

                        // センサーなら反応させる
                        if (cell.type === CellType.SENSOR) {
                            cell.nextPowered = true;
                            // 即時反映させないと次のLogic更新までラグがあるため
                            cell.powered = true; 
                        }
                    }
                }
            }
        }
    }

    spawnBall(gx, gy, dir) {
        const cs = this.grid.cellSize;
        const offset = [
            { x: 0.5, y: -0.2 }, // UP
            { x: 1.2, y: 0.5 },  // RIGHT
            { x: 0.5, y: 1.2 },  // DOWN
            { x: -0.2, y: 0.5 }  // LEFT
        ][dir];
        
        const pos = new Vec2((gx + offset.x) * cs, (gy + offset.y) * cs);
        
        const velDir = [
            { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
        ][dir];
        const vel = new Vec2(velDir.x, velDir.y).mult(5);

        this.balls.push({
            pos: pos,
            vel: vel,
            radius: cs * 0.3
        });
    }
}