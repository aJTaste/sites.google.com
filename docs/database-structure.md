# Firebase Realtime Database 構造

## 現在のデータ構造

### /users
ユーザー情報を保存

```
/users
  /{uid}  ← Firebase Authentication の UID
    accountId: string (2-20文字)
    username: string (1-100文字)
    iconUrl: string (base64 または "default")
    role: "owner" | "moderator" | "verified" | "user"
    createdAt: number (タイムスタンプ)
    online: boolean
    lastOnline: number (タイムスタンプ)
```

**例**:
```json
{
  "users": {
    "abc123def456": {
      "accountId": "taro2024",
      "username": "田中太郎",
      "iconUrl": "data:image/png;base64,...",
      "role": "user",
      "createdAt": 1699000000000,
      "online": true,
      "lastOnline": 1699000000000
    }
  }
}
```

### /dms
ダイレクトメッセージを保存

```
/dms
  /{dmId}  ← 2人のユーザーIDをアルファベット順にソートして "_" で結合
    /participants
      /{userId1}: true
      /{userId2}: true
    /messages
      /{messageId}  ← Firebase の push() で自動生成
        senderId: string (送信者のUID)
        text: string (メッセージ内容)
        timestamp: number (タイムスタンプ)
```

**dmId の生成ルール**:
- ユーザーA (`abc123`) とユーザーB (`xyz789`) の DM
- dmId = `["abc123", "xyz789"].sort().join("_")` = `"abc123_xyz789"`
- これにより、どちらがメッセージを送っても同じ dmId が使われる

**例**:
```json
{
  "dms": {
    "abc123_xyz789": {
      "participants": {
        "abc123": true,
        "xyz789": true
      },
      "messages": {
        "-NaBC123def": {
          "senderId": "abc123",
          "text": "こんにちは！",
          "timestamp": 1699000000000
        },
        "-NaBC456ghi": {
          "senderId": "xyz789",
          "text": "よろしくお願いします",
          "timestamp": 1699000001000
        }
      }
    }
  }
}
```

## 将来の拡張予定

### /servers（未実装）
サーバー（Discord風のグループ）を保存

```
/servers
  /{serverId}
    name: string
    ownerId: string
    createdAt: number
    /members
      /{userId}
        role: "server_owner" | "server_mod" | "member"
        joinedAt: number
    /channels
      /{channelId}
        name: string
        type: "text" | "voice"
        createdAt: number
        /messages
          /{messageId}
            senderId: string
            text: string
            timestamp: number
```

## データベースルール

### 現在の設定
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

**重要**: 認証済みユーザーのみ読み書き可能

### 将来的なセキュリティ強化案
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'owner'"
      }
    },
    "dms": {
      "$dmId": {
        ".read": "root.child('dms').child($dmId).child('participants').child(auth.uid).exists()",
        ".write": "root.child('dms').child($dmId).child('participants').child(auth.uid).exists()"
      }
    }
  }
}
```

## クエリとインデックス

### 現在使用しているクエリ

1. **ユーザー一覧取得**
   ```javascript
   onValue(ref(database, 'users'), (snapshot) => {...})
   ```

2. **特定ユーザーのデータ取得**
   ```javascript
   get(ref(database, `users/${uid}`))
   ```

3. **DM メッセージ取得**
   ```javascript
   onValue(ref(database, `dms/${dmId}/messages`), (snapshot) => {...})
   ```

### インデックス
現在は不要（データ量が少ないため）

将来的にメッセージ数が増えた場合、以下のインデックスが必要になる可能性：
- `timestamp` でのソート
- `senderId` でのフィルタ

## データサイズの見積もり

### 1ユーザーあたり
- ユーザー情報: 約 1KB（アイコンが base64 の場合は最大 500KB）
- 1メッセージ: 約 0.5KB

### 100人が1000メッセージずつ送った場合
- ユーザー情報: 100 × 1KB = 100KB
- メッセージ: 100,000 × 0.5KB = 50MB

Firebase の無料枠（1GB）で十分対応可能

## バックアップとメンテナンス

### 推奨事項
1. 定期的にデータをエクスポート
2. 古いメッセージの削除機能（将来的に）
3. アイコン画像の最適化（圧縮）

### 削除時の注意
- `/users` は絶対に削除しない（認証と紐づいている）
- チャット関連データ（`/dms`, `/messages` など）は削除可能