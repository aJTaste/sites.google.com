/**
 * 検索キー + 数字キーのショートカットで、画面の表示モードを切り替えるJavaScriptファイル
 */

// 現在適用されているフィルターモードと、最後に押されたキーを追跡
let currentMode = 0; // 0: デフォルト
let lastPressedKey = ''; // 最後に押された数字キー ('0', '1', '2'など)

// 表示モードを適用する関数
function setDisplayMode(mode, key) {
    const bodyStyle = document.body.style;

    // 同じショートカットキーが連続で押された場合、リセット（モード0）に切り替える
    if (lastPressedKey === key && mode !== 0) {
        mode = 0;
        key = ''; // リセット実行後はキー記録をクリア
    }

    currentMode = mode;
    lastPressedKey = key;

    switch (mode) {
        case 0:
            // モード0: デフォルト (フィルタなし)
            bodyStyle.filter = 'none';
            bodyStyle.backgroundColor = ''; // bodyの背景色もデフォルトに戻す
            console.log("モード0: デフォルト表示 (リセット)");
            break;
        case 1:
            // モード1: 真っ白 (明るさ最大)
            // コントラストも上げて、ほぼ完全な白飛び状態にする
            bodyStyle.filter = 'brightness(500%) contrast(1000%)';
            console.log("モード1: 真っ白モード");
            break;
        case 2:
            // モード2: 真っ黒 (画面全体を覆うオーバーレイ方式に変更)
            // フィルタでは要素の背景色が透ける場合があるため、オーバーレイ要素を使う
            applyBlackOverlay();
            console.log("モード2: 真っ黒モード (オーバーレイ適用)");
            return; // オーバーレイ処理後はここで終了
        case 3:
            // モード3: セピア調
            bodyStyle.filter = 'sepia(100%) brightness(90%) contrast(110%)';
            console.log("モード3: セピアモード");
            break;
        case 4:
            // モード4: 強コントラスト＆彩度抑えめ
            bodyStyle.filter = 'contrast(180%) saturate(50%)';
            console.log("モード4: 強コントラストモード");
            break;
        case 5:
            // モード5: 暖色系フィルタ (オレンジ色のフィルタを適用)
            // CSS filterだけでは難しいので、bodyのスタイルを変更
            bodyStyle.filter = 'none';
            bodyStyle.backgroundColor = '#ffeedd'; // 薄いオレンジ色の背景を追加
            console.log("モード5: 暖色系フィルタ");
            break;
        // 6以降は追加可能
        default:
            setDisplayMode(0, '');
    }
    
    // モード2以外が選択された場合、黒オーバーレイを非表示にする
    removeBlackOverlay();
}

// モード2用の真っ黒オーバーレイを管理する関数
function applyBlackOverlay() {
    let overlay = document.getElementById('full-black-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'full-black-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: '#000000', zIndex: '99998', opacity: '0',
            transition: 'opacity 0.3s ease-in-out',
        });
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
    setTimeout(() => overlay.style.opacity = '1', 10);
    // 他のフィルタモードと競合しないようにbodyフィルタはリセット
    document.body.style.filter = 'none';
}

function removeBlackOverlay() {
    const overlay = document.getElementById('full-black-overlay');
    if (overlay && overlay.style.display !== 'none') {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 300);
    }
}


// キーボードイベントを監視する
document.addEventListener('keydown', function(event) {
    // Chromebookの検索キー (Metaキー) が押されていることを確認
    if (event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        
        let modeToSet = -1;
        let keyPressed = '';

        // 押されたキーが数字の0から5かを判定
        if (event.key === '0' || event.code === 'Digit0') { modeToSet = 0; keyPressed = '0'; }
        else if (event.key === '1' || event.code === 'Digit1') { modeToSet = 1; keyPressed = '1'; }
        else if (event.key === '2' || event.code === 'Digit2') { modeToSet = 2; keyPressed = '2'; }
        else if (event.key === '3' || event.code === 'Digit3') { modeToSet = 3; keyPressed = '3'; }
        else if (event.key === '4' || event.code === 'Digit4') { modeToSet = 4; keyPressed = '4'; }
        else if (event.key === '5' || event.code === 'Digit5') { modeToSet = 5; keyPressed = '5'; }

        if (modeToSet !== -1) {
            event.preventDefault(); // OSのデフォルト動作を抑制
            setDisplayMode(modeToSet, keyPressed);
        }
    }
});

// body要素にスムーズな切り替えのためのトランジションを追加
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.transition = 'filter 0.5s ease, background-color 0.5s ease';
    // ページ読み込み時のデフォルトモードを設定
    setDisplayMode(0, '');
});
