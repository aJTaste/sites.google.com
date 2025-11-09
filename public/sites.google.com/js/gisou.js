/**
 * Chromebookの検索キー + 1 が押されたときに、ページ全体を
 * 真っ暗なオーバーレイで覆う（または元に戻す）JavaScriptファイル
 */

// ... (toggleDarkOverlay() 関数や createDarkOverlay() 関数は前回のコードと同じです) ...
function createDarkOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'dark-overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        backgroundColor: '#000000', display: 'none', zIndex: '99999',
        opacity: '0', transition: 'opacity 0.3s ease-in-out',
    });
    document.body.appendChild(overlay);
}

function toggleDarkOverlay() {
    const overlay = document.getElementById('dark-overlay');
    if (overlay) {
        if (overlay.style.display === 'none' || overlay.style.opacity === '0') {
            overlay.style.display = 'block';
            setTimeout(() => { overlay.style.opacity = '1'; }, 10);
        } else {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.style.display = 'none'; }, 300);
        }
    }
}
document.addEventListener('DOMContentLoaded', createDarkOverlay);


// キーボードイベントを監視する (変更箇所はここです)
document.addEventListener('keydown', function(event) {
    // Chromebookの検索キー (Metaキーとして扱われることが多い) と '1' キーが同時に押されたかを判定する
    // 他の修飾キー (Ctrl, Shift, Alt) は押されていないことを確認する
    if (event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (event.key === '1' || event.code === 'Digit1')) {
        
        event.preventDefault(); // デフォルトの動作を抑制

        console.log("検索キー + 1 のショートカットが押されました。画面を暗く/明るく切り替えます。");
        toggleDarkOverlay();
    }
});
