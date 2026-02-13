import { Grid } from './grid.js';
import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { Dir } from './types.js';

class Game {
    constructor() {
        this.cellSize = 20;
        // 画面サイズに合わせてグリッド作成
        const w = Math.ceil(window.innerWidth / this.cellSize);
        const h = Math.ceil(window.innerHeight / this.cellSize);
        
        this.grid = new Grid(w, h, this.cellSize);
        this.sim = new Simulation(this.grid);
        this.renderer = new Renderer(document.getElementById('simCanvas'), this.grid, this.sim);
        this.currentRotation = Dir.UP;
        this.paused = false;
        
        this.ui = new UI(this);
        
        this.lastTime = 0;
        
        window.addEventListener('resize', () => this.renderer.resize());
        
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (!this.paused) {
            this.sim.update();
        }
        this.renderer.draw();
        
        this.ui.updateFPS(1000 / dt);

        requestAnimationFrame(this.loop);
    }
}

// ゲーム開始
window.onload = () => {
    new Game();
};