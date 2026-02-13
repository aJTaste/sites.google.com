document.addEventListener('DOMContentLoaded', () => {
    const GRID_SIZE = 8;
    let gridData = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    let particles = [];
    let savedObjects = {};
    let isPlaying = false;
    let simulationInterval = null;
    let currentPaletteItem = { type: 'empty' };
    let currentParticleDir = { x: 1, y: 0, label: 'right' }; // 初期方向: 右

    // DOM Elements
    const mainGrid = document.getElementById('main-grid');
    const btnPlay = document.getElementById('btn-play');
    const btnStep = document.getElementById('btn-step');
    const btnReset = document.getElementById('btn-reset');
    const btnClear = document.getElementById('btn-clear');
    const btnSaveObject = document.getElementById('btn-save-object');
    const inputObjectName = document.getElementById('object-name');
    const paletteContainer = document.getElementById('palette');
    const particleDirControls = document.getElementById('particle-direction-controls');
    const btnExport = document.getElementById('btn-export');
    const fileImport = document.getElementById('file-import');

    // Initialize Grid UI
    function initGrid() {
        mainGrid.innerHTML = '';
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.addEventListener('click', handleCellClick);
                mainGrid.appendChild(cell);
            }
        }
        renderGrid();
    }

    // Rendering
    function renderGrid() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.className = 'cell';
            cell.innerHTML = '';
            cell.removeAttribute('data-obj-name');
        });

        // Render Static Elements (Walls, Objects)
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cellData = gridData[y][x];
                const cellIndex = y * GRID_SIZE + x;
                const cellEl = cells[cellIndex];

                if (cellData === 'wall') {
                    cellEl.classList.add('wall');
                } else if (cellData && cellData.type === 'object') {
                    cellEl.classList.add('object-block');
                    cellEl.innerText = cellData.name.substring(0, 4).toUpperCase(); // 簡易表示
                    cellEl.dataset.objName = cellData.name;
                }
            }
        }

        // Render Particles
        particles.forEach(p => {
            const cellIndex = p.y * GRID_SIZE + p.x;
            if (cells[cellIndex]) {
                const particleEl = document.createElement('div');
                particleEl.classList.add('particle');
                // 進行方向を少しだけ示す（オプション）
                // particleEl.style.transform = `translate(${p.dir.x * 10}%, ${p.dir.y * 10}%)`;
                cells[cellIndex].appendChild(particleEl);
            }
        });
    }

    // Event Handling: Cell Click
    function handleCellClick(e) {
        if (isPlaying) return; // 再生中は編集不可
        const x = parseInt(e.target.dataset.x);
        const y = parseInt(e.target.dataset.y);

        if (currentPaletteItem.type === 'empty') {
            gridData[y][x] = null;
            particles = particles.filter(p => p.x !== x || p.y !== y);
        } else if (currentPaletteItem.type === 'wall') {
            gridData[y][x] = 'wall';
            particles = particles.filter(p => p.x !== x || p.y !== y);
        } else if (currentPaletteItem.type === 'particle') {
            gridData[y][x] = null; // 既存の静的要素をクリア
            particles = particles.filter(p => p.x !== x || p.y !== y); // 既存の粒子をクリア
            particles.push({ x, y, dir: { ...currentParticleDir } });
        } else if (currentPaletteItem.type === 'object') {
            gridData[y][x] = { type: 'object', name: currentPaletteItem.name, data: savedObjects[currentPaletteItem.name] };
            particles = particles.filter(p => p.x !== x || p.y !== y);
        }
        renderGrid();
    }

    // Event Handling: Palette Selection
    paletteContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('palette-item')) {
            document.querySelectorAll('.palette-item').forEach(item => item.classList.remove('active'));
            e.target.classList.add('active');
            currentPaletteItem.type = e.target.dataset.type;
            currentPaletteItem.name = e.target.dataset.name || null;

            // 粒子選択時のみ方向コントローラーを表示
            particleDirControls.style.display = currentPaletteItem.type === 'particle' ? 'block' : 'none';
        }
    });

    // Event Handling: Particle Direction
    particleDirControls.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            particleDirControls.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const dirLabel = e.target.dataset.dir;
            currentParticleDir.label = dirLabel;
            switch (dirLabel) {
                case 'up': currentParticleDir.x = 0; currentParticleDir.y = -1; break;
                case 'down': currentParticleDir.x = 0; currentParticleDir.y = 1; break;
                case 'left': currentParticleDir.x = -1; currentParticleDir.y = 0; break;
                case 'right': currentParticleDir.x = 1; currentParticleDir.y = 0; break;
            }
        });
    });


    // Simulation Logic
    function gameLoop() {
        let nextParticles = [];

        particles.forEach(p => {
            let nextX = p.x + p.dir.x;
            let nextY = p.y + p.dir.y;
            let nextDir = { ...p.dir };
            let bounced = false;

            // 壁または境界との衝突判定
            if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
                // 画面端：反転
                nextDir.x *= -1; nextDir.y *= -1;
                nextX = p.x + nextDir.x; nextY = p.y + nextDir.y;
                bounced = true;
            } else {
                const targetCell = gridData[nextY][nextX];
                if (targetCell === 'wall') {
                    // 壁：単純反転
                    nextDir.x *= -1; nextDir.y *= -1;
                    nextX = p.x + nextDir.x; nextY = p.y + nextDir.y;
                    bounced = true;
                } else if (targetCell && targetCell.type === 'object') {
                    // オブジェクトブロックとの衝突 (簡易シミュレーション)
                    // ブロック内部が空なら直進、壁があれば反転とみなす簡易ロジック
                    // ※本来はここで再帰的に内部シミュレーションを行うが、今回は簡易化する。
                    // 進入したセルに対応する内部グリッドのセルをチェック
                    const internalGrid = targetCell.data.grid;
                    // 進入位置から内部座標を推測（簡易的）
                    let internalX = nextX % GRID_SIZE; 
                    let internalY = nextY % GRID_SIZE;
                    
                    // 進入方向の逆側にある内部セルをチェック
                    if (p.dir.x > 0) internalX = 0; else if (p.dir.x < 0) internalX = GRID_SIZE - 1;
                    if (p.dir.y > 0) internalY = 0; else if (p.dir.y < 0) internalY = GRID_SIZE - 1;
                    
                    // 内部が壁なら反転、空なら通過（通過の場合はブロックを飛び越える）
                    if (internalGrid[internalY][internalX] === 'wall') {
                         nextDir.x *= -1; nextDir.y *= -1;
                         nextX = p.x + nextDir.x; nextY = p.y + nextDir.y;
                    } else {
                        // 通過：ブロックの向こう側へ移動
                        nextX += p.dir.x;
                        nextY += p.dir.y;
                    }
                    bounced = true;
                }
            }

            // 反射後、再度画面外に出る場合のガード処理（隅での反射など）
            if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
                 nextX = p.x; nextY = p.y; // 動かない
            }

            nextParticles.push({ x: nextX, y: nextY, dir: nextDir });
        });
        
        // 粒子同士の衝突判定（単純化：同じ位置に来たら両方反転して元の位置へ）
        let finalParticles = [];
        let posMap = {};
        nextParticles.forEach((p, index) => {
            const key = `${p.x},${p.y}`;
            if (posMap[key]) {
                // 衝突発生：相手と自分を反転させて元の位置に戻す（簡易処理）
                const opponentIndex = posMap[key];
                const opponent = nextParticles[opponentIndex];
                
                // 相手を元の位置で反転
                finalParticles[opponentIndex].x -= opponent.dir.x;
                finalParticles[opponentIndex].y -= opponent.dir.y;
                finalParticles[opponentIndex].dir.x *= -1;
                finalParticles[opponentIndex].dir.y *= -1;
                
                // 自分を元の位置で反転して追加
                finalParticles.push({
                    x: p.x - p.dir.x,
                    y: p.y - p.dir.y,
                    dir: { x: p.dir.x * -1, y: p.dir.y * -1 }
                });
            } else {
                posMap[key] = index;
                finalParticles.push(p);
            }
        });

        particles = finalParticles;
        renderGrid();
    }

    // Controls Logic
    btnPlay.addEventListener('click', () => {
        isPlaying = !isPlaying;
        if (isPlaying) {
            btnPlay.textContent = 'PAUSE';
            simulationInterval = setInterval(gameLoop, 200); // 200msごとに更新
        } else {
            btnPlay.textContent = 'PLAY';
            clearInterval(simulationInterval);
        }
    });

    btnStep.addEventListener('click', () => {
        if (isPlaying) return;
        gameLoop();
    });

    btnReset.addEventListener('click', () => {
        if (isPlaying) btnPlay.click();
        // 初期状態に戻す（粒子の位置だけリセット、壁はそのまま）
        // ※今回は簡易的に、現在の粒子を削除する動きにする。
        // 本来は初期配置を記憶しておく必要がある。
        particles = [];
        renderGrid();
    });

    btnClear.addEventListener('click', () => {
        if (isPlaying) btnPlay.click();
        gridData = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
        particles = [];
        renderGrid();
    });


    // Object Saving Logic
    function updatePaletteUI() {
        // 既存のカスタムオブジェクトボタンを削除
        const customItems = paletteContainer.querySelectorAll('.palette-item[data-type="object"]');
        customItems.forEach(item => item.remove());

        // 保存されたオブジェクトを追加
        for (const name in savedObjects) {
            const item = document.createElement('div');
            item.classList.add('palette-item');
            item.dataset.type = 'object';
            item.dataset.name = name;
            item.textContent = `OBJ: ${name}`;
            paletteContainer.appendChild(item);
        }
    }

    btnSaveObject.addEventListener('click', () => {
        const name = inputObjectName.value.trim();
        if (!name) { alert('Please enter an object name.'); return; }
        if (savedObjects[name] && !confirm(`Overwrite object "${name}"?`)) return;

        // 現在のグリッド状態（壁のみ）を保存。粒子は保存しない仕様とする。
        const gridSnapshot = gridData.map(row => row.map(cell => {
            if (cell === 'wall') return 'wall';
            // 再帰的なオブジェクト保存は複雑になるため、今回は「壁の配置」のみを保存する形に留める。
            // 実用的な再帰構造にするには、ここを深く実装する必要がある。
            if (cell && cell.type === 'object') return 'wall'; // 簡易的に壁として保存
            return null;
        }));

        savedObjects[name] = { grid: gridSnapshot };
        updatePaletteUI();
        inputObjectName.value = '';
        alert(`Object "${name}" saved to palette.`);
    });


    // Data Import/Export Logic
    btnExport.addEventListener('click', () => {
        if (Object.keys(savedObjects).length === 0) {
            alert('No objects to save.');
            return;
        }
        const dataStr = JSON.stringify(savedObjects, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'fractal_bit_data.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });

    fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                // データの簡易バリデーション
                if (typeof importedData !== 'object') throw new Error('Invalid data format.');
                
                // 既存のデータにマージするか、置き換えるか。今回はマージする。
                Object.assign(savedObjects, importedData);
                updatePaletteUI();
                alert('Data imported successfully.');
            } catch (err) {
                alert('Failed to import data: ' + err.message);
            }
            fileImport.value = ''; // ファイル選択をリセット
        };
        reader.readAsText(file);
    });


    // Initial Setup
    initGrid();
    updatePaletteUI();
    // 初期ロード時にローカルストレージから復元したい場合はここに記述
});