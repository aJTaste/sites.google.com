import { CellType } from './types.js';
import { Vec2 } from './math.js';

export class Simulation {
    constructor(grid) {
        this.grid = grid;
        this.balls = [];
        this.gravity = new Vec2(0, 0.2);
        this.tickCounter = 0;
    }

    update() {
        this.updateLogic();
        this.updatePhysics();
        this.tickCounter++;
    }

    updateLogic() {
        // Mapのイテレーション
        for (const cell of this.grid.cells.values()) {
            if (cell.type === CellType.WALL) continue;
            
            // Simulation logic is mostly same, just accessing coords from cell.x/y
            const hasInput = this.checkInput(cell.x, cell.y, cell);
            
            switch (cell.type) {
                case CellType.BATTERY: cell.nextPowered = true; break;
                case CellType.WIRE:
                case CellType.LAMP:
                case CellType.PISTON:
                case CellType.SPAWNER:
                    cell.nextPowered = hasInput; break;
                case CellType.NOT:
                    const backInput = this.getInputFromDir(cell.x, cell.y, (cell.rotation + 2) % 4);
                    cell.nextPowered = !backInput; break;
                case CellType.DIODE:
                    cell.nextPowered = this.getInputFromDir(cell.x, cell.y, (cell.rotation + 2) % 4); break;
                case CellType.SENSOR:
                    cell.nextPowered = false; break;
            }
        }

        // Apply state
        for (const cell of this.grid.cells.values()) {
            cell.powered = cell.nextPowered;
        }

        // Spawners
        if (this.tickCounter % 20 === 0) { // 間隔調整
            for (const cell of this.grid.cells.values()) {
                if (cell.powered && cell.type === CellType.SPAWNER) {
                    this.spawnBall(cell.x, cell.y, cell.rotation);
                }
            }
        }
    }

    checkInput(x, y, selfCell) {
        const dirs = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
        for (let i = 0; i < 4; i++) {
            if (selfCell.directional && i === selfCell.rotation) continue;
            const neighbor = this.grid.getCell(x + dirs[i].dx, y + dirs[i].dy);
            if (!neighbor) continue;
            if (neighbor.powered) {
                if (!neighbor.directional) return true;
                if (neighbor.directional) {
                    if (neighbor.rotation === (i + 2) % 4) return true;
                }
            }
        }
        return false;
    }

    getInputFromDir(x, y, dir) {
        const dx = [0, 1, 0, -1][dir];
        const dy = [-1, 0, 1, 0][dir];
        const neighbor = this.grid.getCell(x + dx, y + dy);
        if (!neighbor) return false;
        if (neighbor.powered) {
             if (!neighbor.directional) return true;
             if (neighbor.rotation === (dir + 2) % 4) return true;
        }
        return false;
    }

    updatePhysics() {
        const cs = this.grid.cellSize;
        
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];
            ball.vel = ball.vel.add(this.gravity);
            ball.pos = ball.pos.add(ball.vel);
            ball.vel = ball.vel.mult(0.99);

            // 衝突判定 (周囲のセルだけ取得して判定)
            const gx = Math.floor(ball.pos.x / cs);
            const gy = Math.floor(ball.pos.y / cs);

            // 画面外削除判定(簡易) - yが極端に大きい場合のみ
            if (ball.pos.y > 100000) { this.balls.splice(i, 1); continue; }

            for (let y = gy - 1; y <= gy + 1; y++) {
                for (let x = gx - 1; x <= gx + 1; x++) {
                    const cell = this.grid.getCell(x, y);
                    if (!cell) continue;
                    
                    const solid = [CellType.WALL, CellType.BATTERY, CellType.LAMP, CellType.NOT, CellType.DIODE, CellType.PISTON, CellType.SPAWNER, CellType.SENSOR].includes(cell.type);
                    if (solid) {
                        this.resolveCollision(ball, cell, x, y, cs);
                    }
                }
            }
        }
    }

    resolveCollision(ball, cell, x, y, cs) {
        const cellRect = { x: x * cs, y: y * cs, w: cs, h: cs };
        const closestX = Math.max(cellRect.x, Math.min(ball.pos.x, cellRect.x + cellRect.w));
        const closestY = Math.max(cellRect.y, Math.min(ball.pos.y, cellRect.y + cellRect.h));
        const dx = ball.pos.x - closestX;
        const dy = ball.pos.y - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ball.radius) {
            const overlap = ball.radius - dist;
            const normal = dist === 0 ? new Vec2(0, -1) : new Vec2(dx, dy).normalize();
            ball.pos = ball.pos.add(normal.mult(overlap));
            
            let bounceForce = 0.6;
            if (cell.type === CellType.PISTON && cell.powered) bounceForce = 1.8;
            
            const dot = ball.vel.x * normal.x + ball.vel.y * normal.y;
            ball.vel = ball.vel.sub(normal.mult(2 * dot));
            ball.vel = ball.vel.mult(bounceForce);

            if (cell.type === CellType.SENSOR) {
                cell.nextPowered = true;
                cell.powered = true;
            }
        }
    }

    spawnBall(gx, gy, dir) {
        const cs = this.grid.cellSize;
        // ... (前のコードと同様のオフセット計算) ...
        const offset = [{x:0.5,y:-0.2}, {x:1.2,y:0.5}, {x:0.5,y:1.2}, {x:-0.2,y:0.5}][dir];
        const velDir = [{x:0,y:-1}, {x:1,y:0}, {x:0,y:1}, {x:-1,y:0}][dir];
        
        this.balls.push({
            pos: new Vec2((gx + offset.x) * cs, (gy + offset.y) * cs),
            vel: new Vec2(velDir.x, velDir.y).mult(5),
            radius: cs * 0.3
        });
    }
}