import { CellType, Dir } from './types.js';

export class Grid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cells = new Array(width * height).fill(null).map(() => ({
            type: CellType.EMPTY,
            rotation: Dir.UP,
            powered: false,     // 現在の電気状態
            nextPowered: false, // 次のフレームの電気状態
            lastUpdate: 0
        }));
    }

    getIndex(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return -1;
        return y * this.width + x;
    }

    getCell(x, y) {
        const idx = this.getIndex(x, y);
        return idx !== -1 ? this.cells[idx] : null;
    }

    setCell(x, y, type, rotation = Dir.UP) {
        const idx = this.getIndex(x, y);
        if (idx !== -1) {
            this.cells[idx] = {
                type: type,
                rotation: rotation,
                powered: false,
                nextPowered: false,
                lastUpdate: 0
            };
        }
    }

    // 座標変換 (スクリーン座標 -> グリッド座標)
    toGrid(screenX, screenY) {
        return {
            x: Math.floor(screenX / this.cellSize),
            y: Math.floor(screenY / this.cellSize)
        };
    }
}