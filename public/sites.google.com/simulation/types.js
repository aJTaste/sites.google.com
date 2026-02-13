// ブロック（セル）の種類定義
export const CellType = {
    EMPTY: 0,
    WALL: 1,      // 物理的な壁（電気通さない）
    WIRE: 2,      // 電線
    BATTERY: 3,   // 電源（常にON）
    NOT: 4,       // NOTゲート（入力がOFFならON）
    DIODE: 5,     // 一方通行
    LAMP: 6,      // 電気が来ると光る
    SENSOR: 7,    // 物理ボールが触れるとON
    PISTON: 8,    // ONになると物理ボールを弾く
    SPAWNER: 9    // ONになるとボールを生成
};

// ブロックのプロパティ定義
export const CellProps = {
    [CellType.EMPTY]: { name: "消しゴム", color: "#fff" },
    [CellType.WALL]: { name: "壁 (Wall)", color: "#000" },
    [CellType.WIRE]: { name: "導線 (Wire)", color: "#aaa" },
    [CellType.BATTERY]: { name: "電源 (Battery)", color: "#000", output: true },
    [CellType.NOT]: { name: "NOTゲート", color: "#000", directional: true },
    [CellType.DIODE]: { name: "ダイオード", color: "#666", directional: true },
    [CellType.LAMP]: { name: "ランプ", color: "#333" },
    [CellType.SENSOR]: { name: "接触センサー", color: "#888" },
    [CellType.PISTON]: { name: "ピストン", color: "#444", directional: true },
    [CellType.SPAWNER]: { name: "ボール生成器", color: "#222", directional: true }
};

// 方向定義
export const Dir = {
    UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3
};