import { CellType, CellProps, Dir } from './types.js';

export class Renderer {
    constructor(canvas, grid, simulation) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.grid = grid;
        this.sim = simulation;
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    draw() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        this.drawBalls();
    }

    drawGrid() {
        const cs = this.grid.cellSize;
        const ctx = this.ctx;

        for (let y = 0; y < this.grid.height; y++) {
            for (let x = 0; x < this.grid.width; x++) {
                const cell = this.grid.getCell(x, y);
                if (cell.type === CellType.EMPTY) continue;

                const cx = x * cs;
                const cy = y * cs;
                const props = CellProps[cell.type];

                // 描画スタイル設定
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#000';
                
                // ON状態なら中を塗りつぶす、OFFなら白抜き
                if (cell.powered) {
                    ctx.fillStyle = props.color;
                    ctx.fillRect(cx, cy, cs, cs);
                    ctx.fillStyle = '#fff'; // テキストやアイコン用
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(cx, cy, cs, cs);
                    ctx.strokeRect(cx, cy, cs, cs);
                    ctx.fillStyle = '#000'; // テキストやアイコン用
                }

                // アイコン/方向描画
                ctx.save();
                ctx.translate(cx + cs/2, cy + cs/2);
                
                // 回転
                if (cell.rotation !== Dir.UP) {
                    ctx.rotate(cell.rotation * Math.PI / 2);
                }

                this.drawCellIcon(ctx, cell.type, cs);
                ctx.restore();
            }
        }
    }

    drawCellIcon(ctx, type, size) {
        const s = size / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px Courier New';

        switch(type) {
            case CellType.WIRE:
                ctx.fillRect(-2, -2, 4, 4);
                break;
            case CellType.BATTERY:
                ctx.fillText("BAT", 0, 0);
                break;
            case CellType.NOT:
                // 三角形
                ctx.beginPath();
                ctx.moveTo(-s/2, s/2);
                ctx.lineTo(s/2, s/2);
                ctx.lineTo(0, -s/2);
                ctx.fill();
                break;
            case CellType.LAMP:
                ctx.beginPath();
                ctx.arc(0, 0, s/1.5, 0, Math.PI*2);
                ctx.stroke();
                break;
            case CellType.PISTON:
                ctx.fillRect(-s/2, 0, s, s/2);
                // 棒
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -s);
                ctx.stroke();
                break;
            case CellType.SPAWNER:
                ctx.fillText("SPW", 0, 0);
                break;
            case CellType.SENSOR:
                ctx.fillText("?", 0, 0);
                ctx.beginPath();
                ctx.arc(0,0, s, 0, Math.PI*2);
                ctx.stroke();
                break;
            case CellType.DIODE:
                ctx.fillText("->", 0, 0);
                break;
        }
    }

    drawBalls() {
        const ctx = this.ctx;
        ctx.fillStyle = '#000';
        for (const ball of this.sim.balls) {
            ctx.beginPath();
            ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}