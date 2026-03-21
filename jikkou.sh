python3 - << 'EOF'
with open('public/sites.google.com/css/chat.css', 'r') as f:
    c = f.read()

# chat.css 内の app-container height 上書きを削除（存在する場合）
c = c.replace(
"""  /* ── レイアウト ──────────────────────────────── */
  .app-container{
    height:100svh;
    height:100dvh;
  }

  /* ── チャットヘッダー ────────────────────────── */""",
"""  /* ── チャットヘッダー ────────────────────────── */""", 1)

# Fix: chat-messages に余計な bottom padding があれば除去
# （chat-messages は自分でスクロールする要素なのでナビバー分は不要）
import re

# 旧モバイルブロック内の chat-messages padding-bottom を修正
c = c.replace(
"""  .chat-messages{
    padding-bottom:calc(56px + env(safe-area-inset-bottom, 0px) + 16px);
  }
  .chat-input-container{
    padding:6px 10px;
    padding-bottom:calc(56px + env(safe-area-inset-bottom,0px) + 8px);
  }""",
"""  .chat-messages{
    padding-bottom:8px;
  }
  .chat-input-container{
    padding:6px 10px calc(6px + env(safe-area-inset-bottom,0px));
  }""", 1)

# Overhaul v2 ブロック内も同様に修正
c = c.replace(
"""  /* ── メッセージリスト ────────────────────────── */
  .chat-messages{
    padding-bottom:calc(56px + env(safe-area-inset-bottom, 0px) + 16px);
  }
  .chat-input-container{
    padding:6px 10px;
    padding-bottom:calc(56px + env(safe-area-inset-bottom,0px) + 8px);
  }""",
"""  /* ── メッセージリスト ────────────────────────── */
  .chat-messages{
    padding-bottom:8px;
  }
  .chat-input-container{
    padding:6px 10px calc(6px + env(safe-area-inset-bottom,0px));
  }""", 1)

# すでに前回修正済みのパターンも対応
c = c.replace(
"""  .chat-messages{
    padding-bottom:8px;
  }
  .chat-input-container{
    padding:6px 10px calc(56px + env(safe-area-inset-bottom,0px) + 8px);
  }""",
"""  .chat-messages{
    padding-bottom:8px;
  }
  .chat-input-container{
    padding:6px 10px calc(6px + env(safe-area-inset-bottom,0px));
  }""")

with open('public/sites.google.com/css/chat.css', 'w') as f:
    f.write(c)
print("chat.css: done")
EOF