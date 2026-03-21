python3 - << 'EOF'
with open('public/sites.google.com/css/chat.css', 'r') as f:
    c = f.read()

# Fix 1: 旧モバイルブロック - chat-messages の誤ったpadding-bottom を除去
#         chat-input-container のpadding を1行にまとめる
old1 = """  .chat-messages{
    padding-bottom:calc(56px + env(safe-area-inset-bottom, 0px) + 16px);
  }
  .chat-input-container{
    padding:6px 10px;
    padding-bottom:calc(56px + env(safe-area-inset-bottom,0px) + 8px);
  }"""
new1 = """  .chat-messages{
    padding-bottom:8px;
  }
  .chat-input-container{
    padding:6px 10px calc(56px + env(safe-area-inset-bottom,0px) + 8px);
  }"""
c = c.replace(old1, new1, 1)

# Fix 2: Chat Mobile Improvements v2 ブロック - 同様の修正
old2 = """  /* ── メッセージリスト ────────────────────────── */
  .chat-messages{
    padding-bottom:calc(56px + env(safe-area-inset-bottom, 0px) + 16px);
  }
  .chat-input-container{
    padding:6px 10px;
    padding-bottom:calc(56px + env(safe-area-inset-bottom,0px) + 8px);
  }"""
new2 = """  /* ── メッセージリスト ────────────────────────── */
  .chat-messages{
    padding-bottom:8px;
  }
  .chat-input-container{
    padding:6px 10px calc(56px + env(safe-area-inset-bottom,0px) + 8px);
  }"""
c = c.replace(old2, new2, 1)

with open('public/sites.google.com/css/chat.css', 'w') as f:
    f.write(c)
print("chat.css: done")
EOF