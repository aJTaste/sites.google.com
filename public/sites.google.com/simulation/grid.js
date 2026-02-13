import { CellType, Dir } from './types.js';

export class Grid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.cells = new Map(); // 配列ではなくMapに変更(無限グリッド対応のため疎行列的に扱う)
    }

    // "x,y" という文字列をキーにする
    _key(x, y) { return `${x},${y}`; }

    getCell(x, y) {
        return this.cells.get(this._key(x, y)) || null;
    }

    setCell(x, y, type, rotation = Dir.UP) {
        const key = this._key(x, y);
        if (type === CellType.EMPTY) {
            this.cells.delete(key);
        } else {
            // 既存の状態があれば保持したいプロパティがあるか確認
            const existing = this.cells.get(key);
            this.cells.set(key, {
                x, y,
                type,
                rotation,
                powered: false,
                nextPowered: false,
                lastUpdate: 0,
                // 一部のプロパティは上書き時に継承しない
            });
        }
    }

    // 範囲内のセルを取得（選択用）
    getCellsInRect(x1, y1, x2, y2) {
        const result = [];
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        for (const [key, cell] of this.cells) {
            if (cell.x >= minX && cell.x <= maxX && cell.y >= minY && cell.y <= maxY) {
                result.push(cell);
            }
        }
        return result;
    }

    clear() {
        this.cells.clear();
    }

    // シリアライズ
    exportJSON() {
        // Mapを配列に変換して保存
        return JSON.stringify(Array.from(this.cells.values()));
    }

    // デシリアライズ
    importJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.cells.clear();
            data.forEach(cellData => {
                // 必須データの復元
                this.cells.set(this._key(cellData.x, cellData.y), {
                    x: cellData.x,
                    y: cellData.y,
                    type: cellData.type,
                    rotation: cellData.rotation,
                    powered: false, // 状態はリセット
                    nextPowered: false,
                    lastUpdate: 0
                });
            });
            return true;
        } catch (e) {
            console.error("Load failed", e);
            return false;
        }
    }
}