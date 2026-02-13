import { CellType, CellProps, Dir } from './types.js';

export class Simulation {
    constructor(grid) {
        this.grid = grid;
        this.balls = [];
        // 前フレームの通電状態を保持（NOT回路のループ制御用）
        this.prevPowered = new Map();
    }

    update() {
        this.updatePhysics();
        this.updateLogic();
    }

    // ---- 物理演算 (ボール) ----
    updatePhysics() {
        for (const ball of this.balls) {
            ball.vy += 0.5; // 重力
            ball.pos.x += ball.vx;
            ball.pos.y += ball.vy;

            if (ball.pos.y > this.grid.height * this.grid.cellSize + 100) {
                ball.remove = true;
            }
        }
        this.balls = this.balls.filter(b => !b.remove);

        const cs = this.grid.cellSize;
        for (const ball of this.balls) {
            const gx = Math.floor(ball.pos.x / cs);
            const gy = Math.floor(ball.pos.y / cs);
            const cell = this.grid.getCell(gx, gy);

            // 壁やOFFのピストンでの跳ね返り
            if (cell && (cell.type === CellType.WALL || (cell.type === CellType.PISTON && !cell.powered))) {
                ball.vy *= -0.5;
                ball.vx *= 0.9;
                ball.pos.y = gy * cs - ball.radius; // 位置補正
            }
            
            // センサー接触判定
            if (cell && cell.type === CellType.SENSOR) {
                cell.activeSignal = true; 
            }
        }
    }

    // ---- 論理回路 (電気) ----
    updateLogic() {
        const cells = Array.from(this.grid.cells.values());
        
        // 1. 状態のバックアップ（NOTゲートの判定用）
        // キーは "x,y" 形式
        const currentInputState = new Map();
        for (const cell of cells) {
            currentInputState.set(`${cell.x},${cell.y}`, cell.powered || cell.activeSignal);
            cell.activeSignal = false; // センサー信号リセット
        }

        // 2. 全リセット（電池以外）
        for (const cell of cells) {
            if (cell.type !== CellType.BATTERY) {
                cell.powered = false;
            } else {
                cell.powered = true;
            }
        }

        // 3. ソース（電気の発生源）を特定してキューに入れる
        let queue = [];

        for (const cell of cells) {
            // A. 電池
            if (cell.type === CellType.BATTERY) {
                queue.push(cell);
            }
            // B. センサー (物理接触があった場合)
            else if (cell.type === CellType.SENSOR && currentInputState.get(`${cell.x},${cell.y}`)) {
                cell.powered = true;
                queue.push(cell);
            }
            // C. NOTゲート (前回のフレームで入力がOFFだった場合のみONになる)
            else if (cell.type === CellType.NOT) {
                // NOTゲートのお尻（入力元）の座標を計算
                const inputDir = (cell.rotation + 2) % 4; 
                const inputPos = this.getNeighborPos(cell.x, cell.y, inputDir);
                const inputKey = `${inputPos.x},${inputPos.y}`;
                
                // 前フレームで、入力元に電気が来ていたか？
                const isInputOn = this.prevPowered.get(inputKey);
                
                if (!isInputOn) {
                    cell.powered = true;
                    queue.push(cell);
                }
            }
        }

        // 4. 電気の拡散 (BFS)
        // ここでのポイント：
        // 「今いるセル(current)」が「どの方向に出せるか」を確認し、
        // 「隣のセル(next)」が「その方向から受け取れるか」を確認する。
        
        let visited = new Set(queue.map(c => `${c.x},${c.y}`));
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            // このセルが電気を出力できる方向のリスト
            const outputDirs = this.getOutputDirs(current);

            for (const dir of outputDirs) {
                // 隣のセルの座標
                const nextPos = this.getNeighborPos(current.x, current.y, dir);
                const nextCell = this.grid.getCell(nextPos.x, nextPos.y);

                if (!nextCell) continue;
                if (nextCell.type === CellType.EMPTY || nextCell.type === CellType.WALL) continue;

                // 既に訪問済みならスキップ
                if (visited.has(`${nextPos.x},${nextPos.y}`)) continue;

                // 重要：隣のセルは、currentからの電気を受け取れるか？
                // dir は current から見た出力方向。
                // nextCell から見ると、電気は (dir + 2) % 4 の方向から来る。
                const incomingDir = (dir + 2) % 4;

                if (this.canAcceptPower(nextCell, incomingDir)) {
                    nextCell.powered = true;
                    visited.add(`${nextCell.x},${nextCell.y}`);
                    
                    // 電気をさらに次に流せるパーツならキューに追加
                    // (ランプやピストンは終端なのでキューに入れない＝ここから電気は出ない)
                    if (nextCell.type === CellType.WIRE || 
                        nextCell.type === CellType.DIODE || 
                        nextCell.type === CellType.NOT) { // NOT自体は入力も受けるが、出力は別途ソース判定で決まるので、ここでは導線的な役割として次へ回さない方が安全だが、直列NOTのために一応通す
                         // ※修正: NOTはソースとして判定済みなので、ここでキューに入れても
                         // 「powered=true」にするだけで、出力ロジックはソース判定に任せるべき。
                         // ただし、NOTの入力側まで電気を運びたいので、WIRE同様に扱う必要はない（NOTは入力を止める）。
                         // したがって、キューに入れるのは WIRE と DIODE だけで良い。
                    }

                    if (nextCell.type === CellType.WIRE || nextCell.type === CellType.DIODE) {
                        queue.push(nextCell);
                    }
                }
            }
        }

        // 現在の通電状態を保存（次フレームの判定用）
        this.prevPowered.clear();
        for (const cell of cells) {
            this.prevPowered.set(`${cell.x},${cell.y}`, cell.powered);
        }
    }

    // ---- ヘルパー関数 ----

    // 指定した座標の隣の座標を取得
    getNeighborPos(x, y, dir) {
        const d = [
            {x:0, y:-1}, // 0: UP
            {x:1, y:0},  // 1: RIGHT
            {x:0, y:1},  // 2: DOWN
            {x:-1, y:0}  // 3: LEFT
        ];
        return { x: x + d[dir].x, y: y + d[dir].y };
    }

    // そのセルが電気を出せる方向を返す
    getOutputDirs(cell) {
        // 電池、ワイヤー、センサー: 全方向に出す
        if (cell.type === CellType.BATTERY || 
            cell.type === CellType.WIRE || 
            cell.type === CellType.SENSOR) {
            return [0, 1, 2, 3];
        }
        // ダイオード、NOT: 向いている方向（前方）だけに出す
        if (cell.type === CellType.DIODE || cell.type === CellType.NOT) {
            return [cell.rotation];
        }
        // ランプ、ピストン: 電気を出さない（終端）
        return [];
    }

    // そのセルが、指定した方向から来る電気を受け取れるか？
    // incomingDir: 自分から見て「どの方角から電気が来たか」 (例: 0なら上から電気が来た)
    canAcceptPower(cell, incomingDir) {
        // ワイヤー、ランプ、ピストン: どこからでも受け取る
        if (cell.type === CellType.WIRE || 
            cell.type === CellType.LAMP || 
            cell.type === CellType.PISTON) {
            return true;
        }

        // ダイオード、NOT: 「お尻（向いている方向の逆）」からしか受け取らない
        if (cell.type === CellType.DIODE || cell.type === CellType.NOT) {
            // 自分の向きの反対側
            const backDir = (cell.rotation + 2) % 4;
            return incomingDir === backDir;
        }

        // それ以外（電池、センサーなど）は入力を受け取らない
        return false;
    }
}