/**
 * Ctrl + Shift + Alt + 1 が押されたときに、ページ全体を
 * 真っ暗なオーバーレイで覆う（または元に戻す）JavaScriptファイル
 */

// オーバーレイ要素を作成し、ページに追加する関数
function createDarkOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'dark-overlay';
    
    // スタイルを設定して、全画面を覆い、最前面に表示する
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: '#000000', // 真っ黒な背景
        display: 'none', // 初期状態では非表示
        zIndex: '99999', // 他の要素よりはるか前面に来るように大きな値を設定
        opacity: '0', // フェードイン/アウトのために初期透明度を0に設定
        transition: 'opacity 0.3s ease-in-out', // スムーズな切り替え効果
    });
    
    document.body.appendChild(overlay);
}

// オーバーレイの表示/非表示を切り替える関数
function toggleDarkOverlay() {
    const overlay = document.getElementById('dark-overlay');
    if (overlay) {
        // 現在の状態を確認して切り替える
        if (overlay.style.display === 'none' || overlay.style.opacity === '0') {
            // 表示する
            overlay.style.display = 'block';
            // display: block にした後、transition を効かせるために少し遅延させる
            setTimeout(() => {
                overlay.style.opacity = '1';
            }, 10);
        } else {
            // 非表示にする (フェードアウト)
            overlay.style.opacity = '0';
            // フェードアウト完了後に display を none に戻す
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300); // transitionの時間と合わせる
        }
    }
}

// ページ読み込み時にオーバーレイ要素を準備する
document.addEventListener('DOMContentLoaded', createDarkOverlay);

// キーボードイベントを監視する
document.addEventListener('keydown', function(event) {
    // Ctrl + Shift + Alt + 1 が同時に押されたかを判定する
    if (event.ctrlKey && event.shiftKey && event.altKey && (event.key === '1' || event.code === 'Digit1')) {
        event.preventDefault(); // デフォルトの動作を抑制

        console.log("Ctrl + Shift + Alt + 1 のショートカットが押されました。画面を暗く/明るく切り替えます。");
        toggleDarkOverlay();
    }
});
