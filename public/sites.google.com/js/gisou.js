/**
 * 検索キー + 数字キーのショートカットで、画面の表示モードを切り替えるJavaScriptファイル
 */

// 現在のフィルターモードを追跡するための変数
let currentMode = 0; // 0: デフォルト

// 表示モードを切り替える関数
function setDisplayMode(mode) {
    const bodyStyle = document.body.style;
    currentMode = mode;

    switch (mode) {
        case 0:
            // モード0: デフォルト (フィルタなし)
            bodyStyle.filter = 'none';
            bodyStyle.backgroundColor = '#fff'; // 背景色もデフォルトに戻す
            console.log("モード0: デフォルト表示");
            break;
        case 1:
            // モード1: 真っ白 (明るさ最大)
            bodyStyle.filter = 'brightness(5)'; /* 500%の明るさ */
            console.log("モード1: 真っ白モード");
            break;
        case 2:
            // モード2: 真っ黒 (コントラストと明るさ最低)
            bodyStyle.filter = 'brightness(0) invert(1)'; /* invert(1)で白黒反転後、brightness(0)で真っ黒に */
            // または、単純にオーバーレイを使う場合は前回のコードを参照
            console.log("モード2: 真っ黒モード");
            break;
        case 3:
            // モード3: セピア調 (落ち着いた色合い)
            bodyStyle.filter = 'sepia(100%)';
            console.log("モード3: セピアモード");
            break;
        case 4:
            // モード4: ネガティブ（反転）モード
            bodyStyle.filter = 'invert(100%) hue-rotate(180deg)';
            console.log("モード4: ネガティブモード");
            break;
        case 5:
            // モード5: 白黒モード（グレースケール）
            bodyStyle.filter = 'grayscale(100%)';
            console.log("モード5: 白黒モード");
            break;
        case 6:
             // モード6: 強コントラスト（シャープな表示）
            bodyStyle.filter = 'contrast(200%)';
            console.log("モード6: 強コントラストモード");
            break;
        default:
            // 7以降はデフォルトに戻す
            setDisplayMode(0);
    }
}

// キーボードイベントを監視する
document.addEventListener('keydown', function(event) {
    // Chromebookの検索キー (Metaキー) が押されていることを確認
    if (event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        
        let modeToSet = -1;
        
        // 押されたキーが数字の1から6かを判定
        if (event.key === '1' || event.code === 'Digit1') modeToSet = 1;
        else if (event.key === '2' || event.code === 'Digit2') modeToSet = 2;
        else if (event.key === '3' || event.code === 'Digit3') modeToSet = 3;
        else if (event.key === '4' || event.code === 'Digit4') modeToSet = 4;
        else if (event.key === '5' || event.code === 'Digit5') modeToSet = 5;
        else if (event.key === '6' || event.code === 'Digit6') modeToSet = 6;

        if (modeToSet !== -1) {
            event.preventDefault(); // OSのデフォルト動作を抑制
            setDisplayMode(modeToSet);
        } else if (event.key === '0' || event.code === 'Digit0') {
             event.preventDefault();
             setDisplayMode(0); // 検索キー+0でデフォルトに戻す
        }
    }
});

// body要素にスムーズな切り替えのためのトランジションを追加
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.transition = 'filter 0.5s ease, background-color 0.5s ease';
});
