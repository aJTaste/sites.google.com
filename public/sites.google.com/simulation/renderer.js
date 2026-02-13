import { CellType, CellProps, Dir } from './types.js';

export class Renderer {
    constructor(canvas, grid, simulation, camera) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.grid = grid;
        this.sim = simulation;
        this.camera = camera;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.resize();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(dpr, dpr);
    }

    draw() {
        const ctx = this.ctx;
        const cvsW = this.canvas.width / (window.devicePixelRatio || 1);
        const cvsH = this.canvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, cvsW, cvsH);
        
        ctx.save();
        ctx.translate(this.camera.offset.x, this.camera.offset.y);
        ctx.scale(this.camera.scale, this.camera.scale);

        this.drawGrid(ctx);
        this.drawBalls(ctx);
        this.drawSelection(ctx);

        ctx.restore();
    }

    drawGrid(ctx) {
        const cs = this.grid.cellSize;
        
        for (const cell of this.grid.cells.values()) {
            const cx = cell.x * cs;
            const cy = cell.y * cs;
            const props = CellProps[cell.type];

            // 共通: 白背景と枠
            ctx.fillStyle = '#fff';
            ctx.fillRect(cx, cy, cs, cs);
            
            // ワイヤーの場合は特殊描画
            if (cell.type === CellType.WIRE) {
                this.drawWire(ctx, cell, cx, cy, cs, props);
            } else {
                // 通常ブロック
                ctx.lineWidth = 1; // 通常は細く
                ctx.strokeStyle = '#ddd';
                ctx.strokeRect(cx, cy, cs, cs);

                if (cell.powered) {
                    ctx.fillStyle = props.color;
                    ctx.fillRect(cx, cy, cs, cs);
                    ctx.fillStyle = '#fff';
                } else {
                    ctx.fillStyle = '#222';
                }

                ctx.save();
                ctx.translate(cx + cs/2, cy + cs/2);
                if (cell.rotation !== Dir.UP) ctx.rotate(cell.rotation * Math.PI / 2);
                this.drawCellIcon(ctx, cell.type, cs);
                ctx.restore();
            }
        }
    }

    // ワイヤー同士や機械と繋がって見えるように描画
    drawWire(ctx, cell, cx, cy, cs, props) {
        const center = cs / 2;
        const lineWidth = cs / 3;

        ctx.fillStyle = cell.powered ? props.color : '#eee'; // OFF時は薄いグレー
        
        // 中心点
        ctx.fillRect(cx + center - lineWidth/2, cy + center - lineWidth/2, lineWidth, lineWidth);

        // 周囲4方向チェック
        const dirs = [
            { dx: 0, dy: -1 }, // UP
            { dx: 1, dy: 0 },  // RIGHT
            { dx: 0, dy: 1 },  // DOWN
            { dx: -1, dy: 0 }  // LEFT
        ];

        dirs.forEach(d => {
            const neighbor = this.grid.getCell(cell.x + d.dx, cell.y + d.dy);
            if (neighbor && neighbor.type !== CellType.EMPTY && neighbor.type !== CellType.WALL) {
                // 壁以外なら繋がる（簡易判定）
                const lx = d.dx === 0 ? cx + center - lineWidth/2 : (d.dx > 0 ? cx + center : cx);
                const ly = d.dy === 0 ? cy + center - lineWidth/2 : (d.dy > 0 ? cy + center : cy);
                const lw = d.dx === 0 ? lineWidth : center;
                const lh = d.dy === 0 ? lineWidth : center;
                ctx.fillRect(lx, ly, lw, lh);
            }
        });
    }

    drawCellIcon(ctx, type, size) {
        const s = size / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px monospace';

        ctx.beginPath();
        switch(type) {
            case CellType.BATTERY: ctx.fillText("⚡", 0, 1); break;
            case CellType.NOT:
                ctx.moveTo(-s/2, s/2); ctx.lineTo(s/2, s/2); ctx.lineTo(0, -s/2); ctx.fill(); 
                // 丸印
                ctx.beginPath(); ctx.arc(0, -s/2 - 2, 2, 0, Math.PI*2); ctx.stroke();
                break;
            case CellType.LAMP:
                ctx.arc(0, 0, s/1.5, 0, Math.PI*2); ctx.stroke(); break;
            case CellType.PISTON:
                ctx.fillRect(-s/2, 0, s, s/2); ctx.moveTo(0,0); ctx.lineTo(0, -s); ctx.stroke(); break;
            case CellType.SPAWNER: ctx.fillText("Box", 0, 0); break;
            case CellType.SENSOR:
                ctx.arc(0,0, s, 0, Math.PI*2); ctx.stroke(); ctx.fillText("!", 0, 1); break;
            case CellType.DIODE: ctx.fillText("▶", 0, 1); break;
        }
    }

    drawBalls(ctx) {
        ctx.fillStyle = '#000';
        for (const ball of this.sim.balls) {
            ctx.beginPath();
            ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawSelection(ctx) {
        if (this.selectionStart && this.selectionEnd) {
            const cs = this.grid.cellSize;
            const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x) * cs;
            const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y) * cs;
            const w = (Math.abs(this.selectionEnd.x - this.selectionStart.x) + 1) * cs;
            const h = (Math.abs(this.selectionEnd.y - this.selectionStart.y) + 1) * cs;

            ctx.save();
            ctx.strokeStyle = '#007bff';
            ctx.lineWidth = 2 / this.camera.scale;
            ctx.setLineDash([5 / this.camera.scale, 5 / this.camera.scale]);
            ctx.strokeRect(x1, y1, w, h);
            ctx.restore();
        }
    }
}