python3 - << 'EOF'
with open('public/sites.google.com/common/common.css', 'r') as f:
    c = f.read()

# リセットブロックにhtml/bodyの完全固定を追加
c = c.replace(
"""/* リセット */
html{background:var(--bg-primary);}
*{
  margin:0;
  padding:0;
  box-sizing:border-box;
}

/* 基本スタイル */
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;
  color:var(--text-primary);
  background:var(--bg-secondary);
  min-height:100vh;
  overscroll-behavior:none;
}""",
"""/* リセット */
html{
  background:var(--bg-primary);
  height:100%;
  overflow:hidden;
  overscroll-behavior:none;
}
*{
  margin:0;
  padding:0;
  box-sizing:border-box;
}

/* 基本スタイル */
body{
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;
  color:var(--text-primary);
  background:var(--bg-secondary);
  height:100%;
  overflow:hidden;
  overscroll-behavior:none;
}""", 1)

with open('public/sites.google.com/common/common.css', 'w') as f:
    f.write(c)
print("done")
EOF