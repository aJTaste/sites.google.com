import { Vec2 } from './math.js';

export class Camera {
    constructor(canvas) {
        this.canvas = canvas;
        this.offset = new Vec2(0, 0); // ワールドの原点が画面のどこにあるか
        this.scale = 1.0;             // ズームレベル
        this.minScale = 0.1;
        this.maxScale = 5.0;
        
        // ドラッグ用
        this.isDragging = false;
        this.lastMouse = new Vec2(0, 0);
    }

    // スクリーン座標(マウス位置) -> ワールド座標(グリッド位置計算用)
    toWorld(screenX, screenY) {
        return new Vec2(
            (screenX - this.offset.x) / this.scale,
            (screenY - this.offset.y) / this.scale
        );
    }

    // ワールド座標 -> スクリーン座標(描画用)
    toScreen(worldX, worldY) {
        return new Vec2(
            worldX * this.scale + this.offset.x,
            worldY * this.scale + this.offset.y
        );
    }

    zoom(amount, centerX, centerY) {
        const worldBefore = this.toWorld(centerX, centerY);
        
        this.scale *= amount;
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale));

        // マウス位置を中心にズームする補正
        const worldAfter = this.toWorld(centerX, centerY);
        this.offset.x += (worldAfter.x - worldBefore.x) * this.scale;
        this.offset.y += (worldAfter.y - worldBefore.y) * this.scale;
    }

    pan(dx, dy) {
        this.offset.x += dx;
        this.offset.y += dy;
    }
}