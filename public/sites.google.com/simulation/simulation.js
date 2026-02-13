import { CellType, CellProps, Dir } from './types.js';

export class Simulation {
    constructor(grid) {
        this.grid = grid;
        this.balls = [];
    }

    update() {
        this.updatePhysics();
        this.updateLogic();
    }

    // ---- 物理演算 (ボール) ----
    updatePhysics() {
        // 重力
        for (const ball of this.balls) {
            ball.vy += 0.5; // Gravity
            ball.pos.x += ball.vx;
            ball.pos.y += ball.vy;

            // 画面外削除
            if (ball.pos.y > this.grid.height * this.grid.cellSize + 100) {
                ball.remove = true;
            }
        }
        this.balls = this.balls.filter(b => !b.remove);

        // 当たり判定 (簡易)
        const cs = this.grid.cellSize;
        for (const ball of this.balls) {
            const gx = Math.floor(ball.pos.x / cs);
            const gy = Math.floor(ball.pos.y / cs);
            const cell = this.grid.getCell(gx, gy);

            if (cell && (cell.type === CellType.WALL || cell.type === CellType.PISTON && !cell.powered)) {
                // 壁に当たったら跳ね返る（簡易）
                ball.vy *= -0.5;
                ball.vx *= 0.9;
                ball.pos.y = gy * cs - ball.radius;
            }
            
            // センサー接触
            if (cell && cell.type === CellType.SENSOR) {
                cell.activeSignal = true; // センサー発動
            }
        }
    }

    // ---- 論理回路 (電気) ----
    updateLogic() {
        const cells = Array.from(this.grid.cells.values());
        
        // 1. 前回の通電状態をバックアップ (論理ゲートの判定に使う)
        // これがないと、信号がループした時に点滅したりバグったりするため
        const prevPowered = new Map();
        for (const cell of cells) {
            prevPowered.set(`${cell.x},${cell.y}`, cell.powered || cell.activeSignal);
            cell.activeSignal = false; // センサー信号は毎回リセット
        }

        // 2. 全ての「受動素子(ワイヤー、ランプ、ピストンなど)」の電気を一旦 OFF にする
        for (const cell of cells) {
            if (cell.type !== CellType.BATTERY) {
                cell.powered = false;
            } else {
                cell.powered = true; // 電池は常にON
            }
        }

        // 3. 電源となる場所（ソース）を探してキューに入れる
        let queue = [];

        for (const cell of cells) {
            // A. 電池はソース
            if (cell.type === CellType.BATTERY) {
                queue.push(cell);
            }
            // B. NOTゲート: 「後ろ」がOFFなら、自分はソースになる
            else if (cell.type === CellType.NOT) {
                const inputPos = this.getBackwardPos(cell.x, cell.y, cell.rotation);
                const inputKey = `${inputPos.x},${inputPos.y}`;
                const isInputOn = prevPowered.get(inputKey); // 前回のフレームで電気が来ていたか？
                
                if (!isInputOn) {
                    cell.powered = true;
                    queue.push(cell);
                }
            }
            // C. センサー: ボールが触れていたらソースになる
            else if (cell.type === CellType.SENSOR && prevPowered.get(`${cell.x},${cell.y}`)) {
                cell.powered = true;
                queue.push(cell);
            }
        }

        // 4. 電気の拡散 (BFS: 幅優先探索)
        // ソースから繋がっている導線を辿って powered = true にしていく
        let visited = new Set(queue.map(c => `${c.x},${c.y}`));
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            // 現在のセルから出力できる方向を取得
            const outputDirs = this.getOutputDirections(current);

            for (const dir of outputDirs) {
                const nextPos = this.getPosInDir(current.x, current.y, dir);
                const nextCell = this.grid.getCell(nextPos.x, nextPos.y);

                if (!nextCell) continue;
                if (visited.has(`${nextPos.x},${nextPos.y}`)) continue;

                // 接続可能かチェック
                if (this.canAcceptPower(nextCell, dir)) {
                    nextCell.powered = true;
                    visited.add(`${nextCell.x},${nextCell.y}`);
                    
                    // ワイヤーならさらに先へ電気を伝える
                    // ランプやピストンは終点なのでキューには入れない（そこから電気は出ない）
                    if (nextCell.type === CellType.WIRE) {
                        queue.push(nextCell);
                    }
                }
            }
        }
        
        // 5. ピストンの物理動作 (ONなら動かす)
        // (簡易実装: ONならボールを弾く処理など。今回は割愛)
    }

    // ---- ヘルパー関数 ----

    // あるセルが、指定した絶対方向へ電気を出せるか？
    getOutputDirections(cell) {
        const dirs = [];
        if (cell.type === CellType.BATTERY || cell.type === CellType.SENSOR || cell.type === CellType.WIRE) {
            // 全方向に拡散
            dirs.push(0, 1, 2, 3);
        } else if (cell.type === CellType.NOT || cell.type === CellType.DIODE) {
            // 向いている方向だけ
            dirs.push(cell.rotation);
        }
        return dirs;
    }

    // あるセルが、指定した方向（からの電気）を受け取れるか？
    // dir: 電気が来る方向（絶対方向）
    canAcceptPower(cell, fromDir) {
        // 壁や空は何もしない
        if (cell.type === CellType.EMPTY || cell.type === CellType.WALL) return false;
        
        // ワイヤー、ランプ、ピストンはどこからでも受け取る
        if (cell.type === CellType.WIRE || cell.type === CellType.LAMP || cell.type === CellType.PISTON) return true;

        // ダイオード、NOTゲートは「後ろ」からしか受け取らない
        // つまり、電気の来る方向(fromDir)が、自分の向き(rotation)と逆であること
        // (0:UP, 1:RIGHT, 2:DOWN, 3:LEFT)
        if (cell.type === CellType.NOT || cell.type === CellType.DIODE) {
            const backDir = (cell.rotation + 2) % 4;
            // fromDirは「ソースから見てどっちに進んだか」。
            // 例: ソースが(0,0)で右(1)に進んで(1,0)に来た。
            // (1,0)にあるNOTが右(1)を向いていたら、入力は左(3)から来る必要がある。
            // fromDir(1) == activeな進行方向。
            // 受け手から見ると「左から来た」= RIGHT方向への進行波。
            
            // シンプルに:
            // NOTが右(1)を向いている。
            // 電気が左から右へ流れてきた(fromDir = 1)。
            // これは「後ろからの入力」なのでOK。
            return fromDir === cell.rotation; 
        }

        return false;
    }

    getBackwardPos(x, y, rotation) {
        // rotationの逆方向の座標
        const backRot = (rotation + 2) % 4;
        return this.getPosInDir(x, y, backRot);
    }

    getPosInDir(x, y, dir) {
        const d = [
            {x:0, y:-1}, // 0: UP
            {x:1, y:0},  // 1: RIGHT
            {x:0, y:1},  // 2: DOWN
            {x:-1, y:0}  // 3: LEFT
        ];
        return { x: x + d[dir].x, y: y + d[dir].y };
    }
}