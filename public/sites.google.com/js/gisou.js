/**
 * 検索キー + 数字キー (0〜9) のショートカットで、画面の表示モードを切り替えるJavaScriptファイル
 */

let lastPressedKey = ''; // 最後に押された数字キー ('0', '1', '2'など)

// 表示モードを適用する関数
function setDisplayMode(mode, key) {
    const bodyStyle = document.body.style;
    let filterStyle = 'none';
    let bgColor = ''; // bodyの背景色は基本空（CSS任せ）

    // 同じショートカットキーが連続で押された場合、リセット（モード0）に切り替える
    if (lastPressedKey === key && mode !== 0) {
        mode = 0;
        key = ''; // リセット実行後はキー記録をクリア
    }

    lastPressedKey = key;
    console.log(`モード設定: ${mode}`);

    // まず、前回のモードで適用した可能性のある特定のスタイルをリセット
    bodyStyle.filter = 'none';
    bodyStyle.backgroundColor = ''; 

    switch (mode) {
        case 0:
            // モード0: デフォルト表示
            break;
        case 1:
            // モード1: 真っ白 (明るさ最大・コントラスト最大)
            filterStyle = 'brightness(500%) contrast(1000%)';
            break;
        case 2:
            // モード2: 真っ黒 (画面を反転させてから明るさを最低にする)
            filterStyle = 'invert(100%) brightness(0%)';
            // または、真っ黒のオーバーレイが必要なら前回のコードの applyBlackOverlay() を使用
            break;
        case 3:
            // モード3: ブルーライト軽減 (セピアと明るさ調整)
            filterStyle = 'sepia(80%) brightness(90%) hue-rotate(330deg)';
            break;
        case 4:
            // モード4: 夜間モード (全体を暗く、青みを加える)
            filterStyle = 'brightness(50%) hue-rotate(180deg) saturate(150%)';
            break;
        case 5:
            // モード5: 集中モード (背景をぼかす + 暗く)
            filterStyle = 'blur(5px) brightness(60%)';
            break;
        case 6:
            // モード6: ハイコントラスト（視認性向上）
            filterStyle = 'contrast(200%)';
            break;
        case 7:
            // モード7: レトロ調 (セピアと明るさ調整)
            filterStyle = 'sepia(100%) brightness(85%)';
            break;
        case 8:
            // モード8: サイバーパンク (鮮やかな色反転)
            filterStyle = 'invert(100%) contrast(150%) hue-rotate(180deg)';
            break;
        case 9:
            // モード9: グレースケール（白黒）
            filterStyle = 'grayscale(100%)';
            break;
    }
    
    // body要素にフィルターを適用する
    bodyStyle.filter = filterStyle;
}


// キーボードイベントを監視する
document.addEventListener('keydown', function(event) {
    // Chromebookの検索キー (Metaキー) が押されていることを確認
    if (event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        
        let modeToSet = -1;
        let keyPressed = '';
        
        // 押されたキーが数字の0から9かを判定
        if (event.key >= '0' && event.key <= '9') {
            modeToSet = parseInt(event.key, 10);
            keyPressed = event.key;
        }

        if (modeToSet !== -1) {
            event.preventDefault(); // OSのデフォルト動作を抑制
            setDisplayMode(modeToSet, keyPressed);
        }
    }
});

// body要素にスムーズな切り替えのためのトランジションを追加
document.addEventListener('DOMContentLoaded', () => {
    // filterプロパティの変更をスムーズにする
    document.body.style.transition = 'filter 0.5s ease';
    // ページ読み込み時のデフォルトモードを設定
    setDisplayMode(0, '');
});
