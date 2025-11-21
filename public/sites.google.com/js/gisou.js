/**
 * 検索キー + 1 または 2 で、真っ白/真っ黒のオーバーレイを切り替えるJavaScriptファイル
 */

let lastPressedKey = ''; // 最後に押された数字キー ('1', '2')

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
            // マウス操作を透過させることで、下のページ操作を可能にする
            pointerEvents: 'none' 
        });
        document.body.appendChild(overlay);
    }
    return overlay;
}

// 表示モードを適用する関数
function setDisplayMode(mode, key) {
    const overlay = getOrCreateOverlay();
    let bgColor = ''; // オーバーレイの色

    // 同じショートカットキーが連続で押された場合、非表示（リセット）に切り替える
    if (lastPressedKey === key) {
        mode = 0; // モード0（非表示）へ移行
        key = ''; // リセット実行後はキー記録をクリア
    }

    lastPressedKey = key;
    console.log(`モード設定: ${mode}`);

    switch (mode) {
        case 1:
            // モード1: 真っ白オーバーレイ
            bgColor = 'rgba(255, 255, 255, 1)';
            break;
        case 2:
            // モード2: 真っ黒オーバーレイ
            bgColor = 'rgba(0, 0, 0, 1)';
            break;
        case 0:
        default:
            // モード0: 非表示
            bgColor = 'rgba(0, 0, 0, 0)'; // 透明に設定
    }
    
    overlay.style.backgroundColor = bgColor;

    if (mode === 0) {
        overlay.style.opacity = '0';
        // アニメーション後にdisplayをnoneにする
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 400); 
    } else {
        overlay.style.display = 'block';
        // display: block後にopacityを1にしてトランジションを発生させる
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
    }
}


// キーボードイベントを監視する
document.addEventListener('keydown', function(event) {
    // Chromebookの検索キー (Metaキー) が押されていることを確認
    if (event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        
        let modeToSet = -1;
        let keyPressed = '';
        
        // 押されたキーが数字の1または2かを判定
        if (event.key === '1' || event.code === 'Digit1') {
            modeToSet = 1;
            keyPressed = '1';
        } else if (event.key === '2' || event.code === 'Digit2') {
            modeToSet = 2;
            keyPressed = '2';
        }

        if (modeToSet !== -1) {
            event.preventDefault(); // OSのデフォルト動作を抑制
            setDisplayMode(modeToSet, keyPressed);
        }
    }
});

// ページ読み込み時にオーバーレイ要素を準備する
document.addEventListener('DOMContentLoaded', () => {
    getOrCreateOverlay(); // 要素を事前に作成しておく
});
