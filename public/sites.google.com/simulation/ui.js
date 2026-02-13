import { CellType, CellProps } from './types.js';

export class UI {
    constructor(game) {
        this.game = game;
        this.toolbar = document.getElementById('tools');
        this.debugInfo = document.getElementById('debug-info');
        this.selectedType = CellType.WALL;
        
        this.createToolbar();
        this.setupInputs();
    }

    createToolbar() {
        Object.keys(CellProps).forEach(key => {
            const type = parseInt(key);
            const prop = CellProps[type];
            const btn = document.createElement('div');
            btn.className = 'tool-btn';
            btn.textContent = prop.name;
            btn.onclick = () => this.selectTool(type, btn);
            if (type === this.selectedType) btn.classList.add('active');
            this.toolbar.appendChild(btn);
        });
    }

    selectTool(type, btnElement) {
        this.selectedType = type;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        if (btnElement) {
            btnElement.classList.add('active');
        } else {
            // インデックスからボタンを探す簡易実装
            const btns = document.querySelectorAll('.tool-btn');
            // Object.keysの順序依存なので注意が必要だが、今回は簡易化
        }
    }

    setupInputs() {
        const canvas = this.game.renderer.canvas;

        let isDrawing = false;
        let isDeleting = false;

        const handleInput = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const gridPos = this.game.grid.toGrid(x, y);

            if (isDrawing) {
                this.game.grid.setCell(gridPos.x, gridPos.y, this.selectedType, this.game.currentRotation);
            } else if (isDeleting) {
                this.game.grid.setCell(gridPos.x, gridPos.y, CellType.EMPTY);
            }
        };

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) isDrawing = true; // 左
            if (e.button === 2) isDeleting = true; // 右
            handleInput(e);
        });

        window.addEventListener('mouseup', () => {
            isDrawing = false;
            isDeleting = false;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDrawing || isDeleting) handleInput(e);
        });

        canvas.addEventListener('contextmenu', e => e.preventDefault());

        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'r') {
                this.game.currentRotation = (this.game.currentRotation + 1) % 4;
            }
            if (e.code === 'Space') {
                this.game.paused = !this.game.paused;
            }
        });
    }

    updateFPS(fps) {
        this.debugInfo.textContent = `FPS: ${fps.toFixed(1)} | Balls: ${this.game.sim.balls.length}`;
    }
}