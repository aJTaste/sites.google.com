# AppHub 実装ログ

## プロジェクト概要
- **プロジェクト名**: AppHub
- **目的**: 学生向けの便利ツール集
- **技術スタック**: HTML, CSS, JavaScript, Firebase (Authentication, Realtime Database)
- **開発環境**: GitHub Codespaces
- **制約**: 
  - Chromebook (NEC Y2) のフィルタリング対応
  - デベロッパーツール使用不可
  - 拡張機能使用不可

## コーディング規約
- 不要な空白は削除（例: `const num=9;`）
- インデントはスペース2個分
- ファイル配置: `public/sites.google.com/` 以下

## 実装済み機能

### 認証システム
- **登録機能** (`register.html`, `js/register.js`)
  - アカウントID（2-20文字）
  - パスワード（8-20文字）
  - ユーザー名（1-100文字）
  - アイコン画像（500KB以下、base64保存）
  - 重複ID チェック
  
- **ログイン機能** (`login.html`, `js/login.js`)
  - アカウントID + パスワード
  - Firebase Auth のメールアドレスは `{accountId}@ajtaste.jp` 形式

### ユーザー管理
- **プロフィール画面** (`profile.html`, `js/profile.js`)
  - ユーザー情報表示
  - 登録日表示
  
- **設定画面** (`settings.html`, `js/settings.js`)
  - ユーザー名変更
  - アイコン変更
  - アカウント情報表示

### 権限システム (`common/permissions.js`)
- **権限レベル**:
  - `owner`: 管理者（全権限）
  - `moderator`: 準管理者（ユーザー管理以外）
  - `verified`: 承認済み（サーバー作成可能）
  - `user`: 一般ユーザー

- **サーバー内権限**:
  - `server_owner`: サーバー主
  - `server_mod`: モデレーター
  - `member`: メンバー

### 管理者パネル (`admin.html`, `js/admin.js`)
- ユーザー一覧表示
- 権限変更機能
- 検索機能
- `owner` 権限のみアクセス可能

### チャット機能（第1フェーズ完了）
**実装日**: 2025-11-03

**ファイル構成**:
- `chat.html` - チャット画面
- `css/chat.css` - スタイル
- `js/chat.js` - メインロジック

**実装済み機能**:
- ✅ ユーザー一覧表示（DM相手選択）
- ✅ オンライン/オフライン状態表示（緑の丸）
- ✅ 最終ログイン時刻表示
- ✅ リアルタイムメッセージ送受信
- ✅ メッセージ日時表示（今日/昨日/それ以前）
- ✅ Enter で送信、Shift+Enter で改行
- ✅ テキストエリア自動リサイズ
- ✅ 連続送信防止（送信中フラグ）
- ✅ レスポンシブデザイン

**解決したバグ**:
1. **ユーザー一覧が表示されない問題**
   - 原因: Firebase Realtime Database のルール設定
   - 解決: ルールを `"auth != null"` に変更

2. **Enter キー連打で大量送信される問題**
   - 原因: 送信処理中もイベントが発火
   - 解決: `isSending` フラグで送信中は処理をブロック

## 未実装機能

### チャット機能（第2フェーズ以降）
- [ ] 未読件数バッジ
- [ ] 既読機能
- [ ] メッセージ削除機能
- [ ] タイピング中表示
- [ ] メッセージ編集機能

### 将来的な機能
- [ ] サーバー機能（Discord風）
- [ ] チャンネル機能
- [ ] HTMLプレビュー機能
- [ ] ファイル共有機能
- [ ] Eaglercraft 統合

## 重要な注意事項

### Firebase 関連
- **データ削除時の注意**: `/users` は絶対に削除しない
- **ルール設定**: 必ず `"auth != null"` に設定
- **オンライン状態管理**: ログイン時に `online: true`、ログアウト/ページ閉じる時に `false` に更新

### 既存ユーザーのデータ移行
- `online`, `lastOnline` フィールドがない既存ユーザーは、ログイン時に自動追加される
- 手動でのデータ追加は不要

### コード記述の注意点
- localStorage/sessionStorage は使用不可（Claude.ai artifacts の制約）
- React artifacts では useState を使用
- HTML artifacts では変数で状態管理

## 次のステップ
1. 未読件数バッジの実装
2. 既読機能の実装
3. メッセージ削除機能の実装