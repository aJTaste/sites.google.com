import { Grid } from './grid.js';
import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { SelectionManager } from './selection.js';
import { CellType, CellProps } from './types.js';

// ---- UI Logic Mixin ----
// 簡単のためMainに記述しますが、本来はUIクラスに分けるべきです
const setupUI = (game) => {
    // ツールバー生成
    const toolbar = document.getElementById('tools');
    
    // 特別なツール: "Select"
    const selectBtn = document.createElement('div');
    selectBtn.className = 'tool-btn';
    selectBtn.textContent = "範囲選択 (Select)";
    selectBtn.onclick = () => {
        game.currentTool = 'SELECT';
        updateActiveBtn(selectBtn);
    };
    toolbar.appendChild(selectBtn);

    // ブロックツール
    Object.keys(CellProps).forEach(key => {
        const type = parseInt(key);
        if (type === CellType.EMPTY) return; // 消しゴムは右クリックにするのでボタン不要
        const prop = CellProps[type];
        const btn = document.createElement('div');
        btn.className = 'tool-btn';
        btn.textContent = prop.name;
        btn.onclick = () => {
            game.currentTool = type;
            updateActiveBtn(btn);
        };
        toolbar.appendChild(btn);
        if (type === CellType.WALL) btn.click(); // デフォルト
    });

    function updateActiveBtn(active) {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        active.classList.add('active');
    }

    // ファイル操作 (File System Access API)
    document.getElementById('btn-save').onclick = async () => {
        try {
            const opts = {
                types: [{
                    description: 'Logic Sandbox File',
                    accept: { 'application/json': ['.json'] },
                }],
            };
            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            await writable.write(game.grid.exportJSON());
            await writable.close();
            document.getElementById('status-msg').textContent = "Saved!";
        } catch (err) {
            console.error(err);
            alert("保存キャンセル、または非対応ブラウザです。");
        }
    };

    document.getElementById('btn-load').onclick = async () => {
        try {
            const [handle] = await window.showOpenFilePicker();
            const file = await handle.getFile();
            const text = await file.text();
            if (game.grid.importJSON(text)) {
                document.getElementById('status-msg').textContent = "Loaded!";
            }
        } catch (err) {
            console.error(err);
        }
    };

    document.getElementById('btn-clear').onclick = () => {
        if(confirm("全消去しますか？")) game.grid.clear();
    };
};

class Game {
    constructor() {
        this.cellSize = 20;
        this.grid = new Grid(this.cellSize);
        this.sim = new Simulation(this.grid);
        
        const canvas = document.getElementById('simCanvas');
        this.camera = new Camera(canvas);
        this.renderer = new Renderer(canvas, this.grid, this.sim, this.camera);
        this.selectionMgr = new SelectionManager(this.grid);
        
        this.currentTool = CellType.WALL;
        this.currentRotation = 0;
        
        this.setupInputs(canvas);
        setupUI(this);
        
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    setupInputs(canvas) {
        // マウス位置管理
        let mouseX = 0, mouseY = 0;
        let isRightDown = false;
        let isLeftDown = false;
        let isMiddleDown = false;

        const getGridPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            // カメラ座標変換
            const worldPos = this.camera.toWorld(e.clientX - rect.left, e.clientY - rect.top);
            return {
                x: Math.floor(worldPos.x / this.cellSize),
                y: Math.floor(worldPos.y / this.cellSize)
            };
        };

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) isLeftDown = true;
            if (e.button === 1) isMiddleDown = true;
            if (e.button === 2) isRightDown = true;
            
            const g = getGridPos(e);

            if (isMiddleDown || (e.code === 'Space' && isLeftDown)) {
                this.camera.isDragging = true;
                this.camera.lastMouse = { x: e.clientX, y: e.clientY };
            } else if (this.currentTool === 'SELECT' && isLeftDown) {
                this.selectionMgr.startSelection(g.x, g.y);
                this.renderer.selectionStart = {x:g.x, y:g.y};
                this.renderer.selectionEnd = {x:g.x, y:g.y};
            } else if (isLeftDown) {
                this.grid.setCell(g.x, g.y, this.currentTool, this.currentRotation);
            } else if (isRightDown) {
                this.grid.setCell(g.x, g.y, CellType.EMPTY);
            }
        });

        window.addEventListener('mouseup', () => {
            isLeftDown = false; isRightDown = false; isMiddleDown = false;
            this.camera.isDragging = false;
            if (this.currentTool === 'SELECT') this.selectionMgr.endSelection();
        });

        canvas.addEventListener('mousemove', (e) => {
            const g = getGridPos(e);
            
            // パン（移動）
            if (this.camera.isDragging) {
                const dx = e.clientX - this.camera.lastMouse.x;
                const dy = e.clientY - this.camera.lastMouse.y;
                this.camera.pan(dx, dy);
                this.camera.lastMouse = { x: e.clientX, y: e.clientY };
                return;
            }

            if (this.currentTool === 'SELECT' && isLeftDown) {
                this.selectionMgr.updateSelection(g.x, g.y);
                this.renderer.selectionEnd = {x:g.x, y:g.y};
            } else if (isLeftDown && this.currentTool !== 'SELECT') {
                this.grid.setCell(g.x, g.y, this.currentTool, this.currentRotation);
            } else if (isRightDown) {
                this.grid.setCell(g.x, g.y, CellType.EMPTY);
            }
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
            const rect = canvas.getBoundingClientRect();
            this.camera.zoom(zoomAmount, e.clientX - rect.left, e.clientY - rect.top);
        }, { passive: false });

        canvas.addEventListener('contextmenu', e => e.preventDefault());

        // キーボード操作
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'r') this.currentRotation = (this.currentRotation + 1) % 4;
            
            // コピペ
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c') {
                    this.selectionMgr.copy();
                    document.getElementById('status-msg').textContent = "Copied!";
                }
                if (e.key === 'v') {
                    // 現在のマウス位置にペースト（簡易的に画面中央付近などでもよいが、今回はマウス位置を取得する術がないため直近のクリック位置などが望ましいが、簡易実装としてカメラ中心へ）
                    // 改善: マウス位置をクラス変数で追跡するのがベスト
                    const center = this.camera.toWorld(canvas.width/2, canvas.height/2);
                    this.selectionMgr.paste(Math.floor(center.x/this.cellSize), Math.floor(center.y/this.cellSize));
                    document.getElementById('status-msg').textContent = "Pasted!";
                }
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                this.selectionMgr.deleteSelected();
                // 選択表示も消す
                this.renderer.selectionStart = null;
                this.renderer.selectionEnd = null;
            }
        });
        
        window.addEventListener('resize', () => this.renderer.resize());
    }

    loop() {
        this.sim.update();
        this.renderer.draw();
        requestAnimationFrame(this.loop);
    }
}

window.onload = () => new Game();