import { CellType } from './types.js';

export class SelectionManager {
    constructor(grid) {
        this.grid = grid;
        this.clipboard = null;
        this.selecting = false;
        this.startPos = null;
        this.endPos = null;
    }

    startSelection(x, y) {
        this.selecting = true;
        this.startPos = {x, y};
        this.endPos = {x, y};
    }

    updateSelection(x, y) {
        if(this.selecting) this.endPos = {x, y};
    }

    endSelection() {
        this.selecting = false;
        // ここで選択範囲確定処理を行ってもよい
    }

    deleteSelected() {
        if (!this.startPos || !this.endPos) return;
        const cells = this.grid.getCellsInRect(this.startPos.x, this.startPos.y, this.endPos.x, this.endPos.y);
        cells.forEach(c => this.grid.setCell(c.x, c.y, CellType.EMPTY));
    }

    copy() {
        if (!this.startPos || !this.endPos) return;
        const cells = this.grid.getCellsInRect(this.startPos.x, this.startPos.y, this.endPos.x, this.endPos.y);
        if (cells.length === 0) return;

        // 基準点を左上に設定
        const refX = Math.min(this.startPos.x, this.endPos.x);
        const refY = Math.min(this.startPos.y, this.endPos.y);

        this.clipboard = cells.map(c => ({
            relX: c.x - refX,
            relY: c.y - refY,
            type: c.type,
            rotation: c.rotation
        }));
        
        console.log(`Copied ${cells.length} cells`);
    }

    paste(targetX, targetY) {
        if (!this.clipboard) return;
        
        this.clipboard.forEach(item => {
            this.grid.setCell(targetX + item.relX, targetY + item.relY, item.type, item.rotation);
        });
    }
}