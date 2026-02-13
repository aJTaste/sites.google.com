document.addEventListener('DOMContentLoaded', () => {
    const GRID_SIZE = 8;
    let gridData = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
    let particles = [];
    let savedObjects = {}; // メモリ上の部品データ
    let isPlaying = false;
    let simulationInterval = null;
    
    // UI状態
    let currentPaletteItem = { type: 'empty' };
    let currentParticleDir = { x: 1, y: 0, label: 'right' };

    // File System Access API用
    let directoryHandle = null;

    // DOM Elements
    const mainGrid = document.getElementById('main-grid');
    const btnPlay = document.getElementById('btn-play');
    const btnStep = document.getElementById('btn-step');
    const btnReset = document.getElementById('btn-reset');
    const btnClear = document.getElementById('btn-clear');
    
    // Object Creation
    const btnSaveObject = document.getElementById('btn-save-object');
    const inputObjectName = document.getElementById('object-name');
    const paletteContainer = document.getElementById('palette');
    const particleDirControls = document.getElementById('particle-direction-controls');
    
    // File Manager
    const btnOpenFolder = document.getElementById('btn-open-folder');
    const fileListContainer = document.getElementById('file-list-container');
    const fileListUl = document.getElementById('file-list');
    const btnSaveToFolder = document.getElementById('btn-save-to-folder');
    const inputSaveName = document.getElementById('file-save-name');
    
    // Legacy Export/Import
    const btnExport = document.getElementById('btn-export');
    const fileImport = document.getElementById('file-import');

    // ----------------------------------------------------
    //  Initialization & Rendering
    // ----------------------------------------------------
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

    function renderGrid() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.className = 'cell';
            cell.innerHTML = '';
        });

        // 静的要素（壁・部品）の描画
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cellData = gridData[y][x];
                const index = y * GRID_SIZE + x;
                const cellEl = cells[index];

                if (cellData === 'wall') {
                    cellEl.classList.add('wall');
                } else if (cellData && cellData.type === 'object') {
                    cellEl.classList.add('object-block');
                    const name = cellData.name;
                    cellEl.innerHTML = `<span>${name.substring(0,6)}</span>`;
                }
            }
        }

        // 粒子の描画
        particles.forEach(p => {
            const index = p.y * GRID_SIZE + p.x;
            if (cells[index]) {
                const pEl = document.createElement('div');
                pEl.classList.add('particle');
                cells[index].appendChild(pEl);
            }
        });
    }

    // ----------------------------------------------------
    //  Interaction Logic
    // ----------------------------------------------------
    function handleCellClick(e) {
        if (isPlaying) return;
        // クリックした要素がcellそのものでない場合（中の文字など）、親のcellを探す
        const target = e.target.closest('.cell');
        if (!target) return;

        const x = parseInt(target.dataset.x);
        const y = parseInt(target.dataset.y);

        const type = currentPaletteItem.type;

        if (type === 'empty') {
            gridData[y][x] = null;
            particles = particles.filter(p => p.x !== x || p.y !== y);
        } else if (type === 'wall') {
            gridData[y][x] = 'wall';
            particles = particles.filter(p => p.x !== x || p.y !== y);
        } else if (type === 'particle') {
            gridData[y][x] = null;
            particles = particles.filter(p => p.x !== x || p.y !== y);
            particles.push({ x, y, dir: { ...currentParticleDir } });
        } else if (type === 'object') {
            const name = currentPaletteItem.name;
            if (savedObjects[name]) {
                gridData[y][x] = { type: 'object', name: name, data: savedObjects[name] };
                particles = particles.filter(p => p.x !== x || p.y !== y);
            }
        }
        renderGrid();
    }

    paletteContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.palette-item');
        if (item) {
            document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            currentPaletteItem.type = item.dataset.type;
            currentPaletteItem.name = item.dataset.name || null;
            
            particleDirControls.style.display = (currentPaletteItem.type === 'particle') ? 'block' : 'none';
        }
    });

    particleDirControls.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            particleDirControls.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const dir = e.target.dataset.dir;
            currentParticleDir.label = dir;
            if (dir === 'up') { currentParticleDir.x = 0; currentParticleDir.y = -1; }
            if (dir === 'down') { currentParticleDir.x = 0; currentParticleDir.y = 1; }
            if (dir === 'left') { currentParticleDir.x = -1; currentParticleDir.y = 0; }
            if (dir === 'right') { currentParticleDir.x = 1; currentParticleDir.y = 0; }
        });
    });

    // ----------------------------------------------------
    //  Game Loop (Simulation)
    // ----------------------------------------------------
    function gameLoop() {
        let nextParticles = [];
        particles.forEach(p => {
            let nextX = p.x + p.dir.x;
            let nextY = p.y + p.dir.y;
            let nextDir = { ...p.dir };

            // 境界・衝突判定
            let hit = false;
            
            // 1. 画面端チェック
            if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
                nextDir.x *= -1; nextDir.y *= -1;
                hit = true;
            } else {
                // 2. グリッド内容チェック
                const cell = gridData[nextY][nextX];
                if (cell === 'wall') {
                    nextDir.x *= -1; nextDir.y *= -1;
                    hit = true;
                } else if (cell && cell.type === 'object') {
                    // 簡易シミュレーション: オブジェクト内部の対応する壁判定
                    // 進入方向の逆側（オブジェクト内部での入口）を計算
                    let inX = (nextX % GRID_SIZE); // ここは簡易化。本来は座標変換が必要
                    let inY = (nextY % GRID_SIZE);
                    
                    // 単純に「オブジェクトは壁として振る舞う」か「空として振る舞う」か
                    // ここでは「内部グリッドに何かしらの壁があれば反射」という簡易ロジックにします
                    // ※より高度なロジックは要件定義の通り「再帰シミュレーション」が必要
                    nextDir.x *= -1; nextDir.y *= -1; 
                    hit = true;
                }
            }

            if (hit) {
                // 反転した位置へ戻る
                nextX = p.x + nextDir.x;
                nextY = p.y + nextDir.y;
                // それでも範囲外なら動かない
                if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
                    nextX = p.x; nextY = p.y;
                }
            }
            nextParticles.push({ x: nextX, y: nextY, dir: nextDir });
        });
        
        // 粒子重複の簡易処理（重なったら消える、あるいはすれ違うなど）
        // ここでは単純に更新
        particles = nextParticles;
        renderGrid();
    }

    btnPlay.addEventListener('click', () => {
        isPlaying = !isPlaying;
        btnPlay.textContent = isPlaying ? '⏸ 一時停止' : '▶ 再生';
        if (isPlaying) {
            simulationInterval = setInterval(gameLoop, 200);
        } else {
            clearInterval(simulationInterval);
        }
    });

    btnStep.addEventListener('click', () => {
        if (!isPlaying) gameLoop();
    });

    btnReset.addEventListener('click', () => {
        if (isPlaying) btnPlay.click();
        // 簡易リセット：粒子を削除（本来は初期位置に戻すべき）
        particles = [];
        renderGrid();
    });

    btnClear.addEventListener('click', () => {
        if (isPlaying) btnPlay.click();
        if(confirm("盤面を全て消去しますか？")) {
            gridData = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
            particles = [];
            renderGrid();
        }
    });

    // ----------------------------------------------------
    //  Object Management (Module)
    // ----------------------------------------------------
    function updatePaletteUI() {
        const customItems = paletteContainer.querySelectorAll('.palette-item[data-type="object"]');
        customItems.forEach(item => item.remove());

        for (const name in savedObjects) {
            const item = document.createElement('div');
            item.classList.add('palette-item');
            item.dataset.type = 'object';
            item.dataset.name = name;
            item.textContent = `部品: ${name}`;
            paletteContainer.appendChild(item);
        }
    }

    btnSaveObject.addEventListener('click', () => {
        const name = inputObjectName.value.trim();
        if (!name) return alert('部品名を入力してください');
        
        // 壁の配置のみ保存（粒子は保存しない）
        const gridSnapshot = gridData.map(row => row.map(cell => {
            if (cell === 'wall') return 'wall';
            if (cell && cell.type === 'object') return 'wall'; // 再帰は壁として潰す（簡易）
            return null;
        }));

        savedObjects[name] = { grid: gridSnapshot };
        updatePaletteUI();
        inputObjectName.value = '';
        alert(`部品 "${name}" をパレットに登録しました`);
    });

    // ----------------------------------------------------
    //  File System Access API (Local Folder)
    // ----------------------------------------------------
    
    // フォルダを開く
    btnOpenFolder.addEventListener('click', async () => {
        try {
            // ディレクトリ選択ダイアログを表示
            directoryHandle = await window.showDirectoryPicker();
            fileListContainer.style.display = 'block';
            document.getElementById('legacy-import-export').style.display = 'none'; // 古いUIを隠す
            await listFiles();
        } catch (err) {
            console.error(err);
            alert('フォルダへのアクセスがキャンセルされたか、このブラウザではサポートされていません。\n※ローカルサーバー(Live Server等)経由で開いているか確認してください。');
        }
    });

    // ファイル一覧を表示
    async function listFiles() {
        if (!directoryHandle) return;
        fileListUl.innerHTML = '';
        
        for await (const entry of directoryHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                const li = document.createElement('li');
                li.innerHTML = `<span>${entry.name}</span> <button style="width:auto; padding:2px 8px; margin:0;">読込</button>`;
                
                // 読み込みボタン処理
                li.querySelector('button').addEventListener('click', async () => {
                    await loadFile(entry);
                });
                
                fileListUl.appendChild(li);
            }
        }
    }

    // ファイルを読み込んでメモリ(savedObjects)に反映
    async function loadFile(fileHandle) {
        try {
            const file = await fileHandle.getFile();
            const text = await file.text();
            const data = JSON.parse(text);
            
            // データを統合
            Object.assign(savedObjects, data);
            updatePaletteUI();
            alert(`${fileHandle.name} を読み込みました。\nパレットを確認してください。`);
        } catch (err) {
            alert('ファイルの読み込みに失敗しました: ' + err.message);
        }
    }

    // 現在のsavedObjectsを指定フォルダに保存
    btnSaveToFolder.addEventListener('click', async () => {
        if (!directoryHandle) return alert('フォルダが接続されていません');
        let filename = inputSaveName.value.trim();
        if (!filename) return alert('ファイル名を入力してください');
        if (!filename.endsWith('.json')) filename += '.json';

        try {
            // ファイルハンドルを作成（同名ファイルがあれば上書き確認が出る場合も）
            const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            
            const jsonStr = JSON.stringify(savedObjects, null, 2);
            await writable.write(jsonStr);
            await writable.close();
            
            alert(`${filename} を保存しました`);
            await listFiles(); // リスト更新
        } catch (err) {
            alert('保存に失敗しました: ' + err.message);
        }
    });

    // ----------------------------------------------------
    //  Legacy Import/Export (Fallback)
    // ----------------------------------------------------
    btnExport.addEventListener('click', () => {
        if (Object.keys(savedObjects).length === 0) return alert('保存するデータがありません');
        const dataStr = JSON.stringify(savedObjects, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fractal_bit_data.json';
        a.click();
    });

    fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                Object.assign(savedObjects, data);
                updatePaletteUI();
                alert('データを読み込みました');
            } catch(err) {
                alert('データ形式が不正です');
            }
        };
        reader.readAsText(file);
    });

    // 初期化
    initGrid();
    updatePaletteUI();
});