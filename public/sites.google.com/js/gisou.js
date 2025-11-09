/**
 * 検索キー + 数字キー (0〜9) のショートカットで、画面の表示モードを切り替えるJavaScriptファイル
 */

let lastPressedKey = ''; // 最後に押された数字キー ('0', '1', '2'など)

// オーバーレイ要素を作成し管理する
function getOrCreateOverlay() {
    let overlay = document.getElementById('custom-mode-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'custom-mode-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            zIndex: '99999', opacity: '0', display: 'none',
            transition: 'opacity 0.4s ease-in-out',
            pointerEvents: 'none' // オーバーレイがあっても下の要素をクリックできるようにする
        });
        document.body.appendChild(overlay);
    }
    return overlay;
}

// 表示モードを適用する関数
function setDisplayMode(mode, key) {
    const overlay = getOrCreateOverlay();
    let filterStyle = 'none';
    let bgColor = 'rgba(0, 0, 0, 0)'; // デフォルトは透明

    // 同じショートカットキーが連続で押された場合、リセット（モード0）に切り替える
    if (lastPressedKey === key && mode !== 0) {
        mode = 0;
        key = ''; // リセット実行後はキー記録をクリア
    }

    lastPressedKey = key;
    console.log(`モード設定: ${mode}`);

    switch (mode) {
        case 0:
            // モード0: デフォルト表示
            break;
        case 1:
            // モード1: 真っ白オーバーレイ
            bgColor = 'rgba(255, 255, 255, 1)';
            break;
        case 2:
            // モード2: 真っ黒オーバーレイ
            bgColor = 'rgba(0, 0, 0, 1)';
            break;
        case 3:
            // モード3: ブルーライト軽減 (暖色オーバーレイ)
            bgColor = 'rgba(255, 160, 0, 0.2)'; // 薄いオレンジ色の半透明
            break;
        case 4:
            // モード4: 夜間モード (暗めのブルー)
            bgColor = 'rgba(0, 0, 50, 0.7)';
            break;
        case 5:
            // モード5: 集中モード (背景をぼかす + 暗く)
            // bodyへのフィルタ適用が必要なため、このモードだけ特殊処理
            overlay.style.display = 'none';
            document.body.style.filter = 'blur(5px) brightness(0.6)';
            console.log("モード5: 集中モード (bodyフィルタ適用)");
            return; 
        case 6:
            // モード6: ハイコントラスト（視認性向上）
            filterStyle = 'contrast(200%) invert(0%)';
            break;
        case 7:
            // モード7: レトロ調 (セピアとノイズを模倣)
            filterStyle = 'sepia(80%) brightness(90%)';
            break;
        case 8:
            // モード8: サイバーパンク (マゼンタとシアンの反転風)
            filterStyle = 'hue-rotate(280deg) contrast(150%) saturate(200%)';
            break;
        case 9:
            // モード9: グレースケール（白黒）
            filterStyle = 'grayscale(100%)';
            break;
    }

    // モード5以外の場合、bodyフィルタをリセットし、オーバーレイを適用
    document.body.style.filter = 'none';
    overlay.style.backgroundColor = bgColor;
    overlay.style.filter = filterStyle;
    
    if (mode === 0) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 400);
    } else {
        overlay.style.display = 'block';
        setTimeout(() => overlay.style.opacity = '1', 10);
    }
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
    document.body.style.transition = 'filter 0.5s ease';
    // ページ読み込み時のデフォルトモードを設定
    setDisplayMode(0, '');
});
