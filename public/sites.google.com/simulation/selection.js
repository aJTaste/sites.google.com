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
    }

    // 範囲内を指定されたタイプで埋める
    fill(type, rotation) {
        if (!this.startPos || !this.endPos) return 0;

        const x1 = Math.min(this.startPos.x, this.endPos.x);
        const x2 = Math.max(this.startPos.x, this.endPos.x);
        const y1 = Math.min(this.startPos.y, this.endPos.y);
        const y2 = Math.max(this.startPos.y, this.endPos.y);

        let count = 0;
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                this.grid.setCell(x, y, type, rotation);
                count++;
            }
        }
        return count;
    }

    deleteSelected() {
        if (!this.startPos || !this.endPos) return;
        // fillを使って消去（EMPTYで埋める）として実装も可能
        this.fill(CellType.EMPTY, 0);
    }

    copy() {
        if (!this.startPos || !this.endPos) return;
        const cells = this.grid.getCellsInRect(this.startPos.x, this.startPos.y, this.endPos.x, this.endPos.y);
        if (cells.length === 0) return;

        const refX = Math.min(this.startPos.x, this.endPos.x);
        const refY = Math.min(this.startPos.y, this.endPos.y);

        this.clipboard = cells.map(c => ({
            relX: c.x - refX,
            relY: c.y - refY,
            type: c.type,
            rotation: c.rotation
        }));
        
        console.log(`Copied ${cells.length} cells`);
        return cells.length;
    }

    paste(targetX, targetY) {
        if (!this.clipboard) return 0;
        
        this.clipboard.forEach(item => {
            this.grid.setCell(targetX + item.relX, targetY + item.relY, item.type, item.rotation);
        });
        return this.clipboard.length;
    }
    
    // 選択範囲があるかどうかチェック
    hasSelection() {
        return this.startPos !== null && this.endPos !== null;
    }
}