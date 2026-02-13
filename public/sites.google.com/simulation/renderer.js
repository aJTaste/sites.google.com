import { CellType, CellProps, Dir } from './types.js';

export class Renderer {
    constructor(canvas, grid, simulation, camera) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.grid = grid;
        this.sim = simulation;
        this.camera = camera;
        
        // 選択範囲用
        this.selectionStart = null;
        this.selectionEnd = null;

        this.resize();
    }

    resize() {
        // High DPI Display 対応
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
        // カメラ変換適用
        ctx.translate(this.camera.offset.x, this.camera.offset.y);
        ctx.scale(this.camera.scale, this.camera.scale);

        this.drawGrid(ctx);
        this.drawBalls(ctx);
        this.drawSelection(ctx);

        ctx.restore();
    }

    drawGrid(ctx) {
        const cs = this.grid.cellSize;
        
        // 画面内にあるセルだけ描画（カリング）最適化は省略しますが、本来はやるべき
        for (const cell of this.grid.cells.values()) {
            const cx = cell.x * cs;
            const cy = cell.y * cs;
            const props = CellProps[cell.type];

            ctx.lineWidth = 2; // 線を太くしてSVGっぽく
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#222';

            if (cell.powered) {
                ctx.fillStyle = props.color;
                ctx.fillRect(cx, cy, cs, cs);
                ctx.fillStyle = '#fff'; 
            } else {
                ctx.fillStyle = '#fff';
                ctx.fillRect(cx, cy, cs, cs);
                ctx.strokeRect(cx, cy, cs, cs);
                ctx.fillStyle = '#222';
            }

            ctx.save();
            ctx.translate(cx + cs/2, cy + cs/2);
            if (cell.rotation !== Dir.UP) ctx.rotate(cell.rotation * Math.PI / 2);
            this.drawCellIcon(ctx, cell.type, cs);
            ctx.restore();
        }
    }

    drawCellIcon(ctx, type, size) {
        const s = size / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px monospace';

        // 図形をパスで描画してSVGライクにする
        ctx.beginPath();
        switch(type) {
            case CellType.WIRE:
                ctx.fillRect(-2, -2, 4, 4); break;
            case CellType.BATTERY:
                ctx.fillText("PWR", 0, 0); break;
            case CellType.NOT:
                ctx.moveTo(-s/2, s/2); ctx.lineTo(s/2, s/2); ctx.lineTo(0, -s/2); ctx.fill(); break;
            case CellType.LAMP:
                ctx.arc(0, 0, s/1.5, 0, Math.PI*2); ctx.stroke(); break;
            case CellType.PISTON:
                ctx.fillRect(-s/2, 0, s, s/2); ctx.moveTo(0,0); ctx.lineTo(0, -s); ctx.stroke(); break;
            case CellType.SPAWNER:
                ctx.fillText("SPW", 0, 0); break;
            case CellType.SENSOR:
                ctx.arc(0,0, s, 0, Math.PI*2); ctx.stroke(); ctx.fillText("?", 0, 0); break;
            case CellType.DIODE:
                ctx.fillText("▶", 0, 0); break;
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
            ctx.fillStyle = 'rgba(0, 123, 255, 0.2)';
            ctx.lineWidth = 2 / this.camera.scale; // ズームしても線の太さを一定に
            ctx.fillRect(x1, y1, w, h);
            ctx.strokeRect(x1, y1, w, h);
            ctx.restore();
        }
    }
}