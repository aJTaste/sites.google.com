# AppHub データベース構造設計書

## users テーブル
**パス:** `/users/{uid}`

```json
{
  "uid": "string (Firebase Auth UID)",
  "accountId": "string (2-20文字)",
  "username": "string (1-100文字)",
  "iconUrl": "string (base64 or 'default')",
  "role": "string (権限レベル)",
  "createdAt": "number (timestamp)",
  "lastOnline": "number (timestamp)",
  "online": "boolean"
}
```

### role の種類
- `owner` - 管理者（あなたのみ）
- `moderator` - 準管理者
- `verified` - 承認済みユーザー（サーバー作成可能）
- `user` - 一般ユーザー（デフォルト）

---

## servers テーブル
**パス:** `/servers/{serverId}`

```json
{
  "serverId": "string (自動生成)",
  "name": "string (サーバー名)",
  "description": "string (説明)",
  "iconUrl": "string (base64 or 'default')",
  "ownerId": "string (作成者のuid)",
  "createdAt": "number (timestamp)",
  "members": {
    "{uid}": "server_owner | server_mod | member"
  }
}
```

### サーバー内の権限
- `server_owner` - サーバー主（作成者）
- `server_mod` - モデレーター
- `member` - 一般メンバー

---

## channels テーブル
**パス:** `/channels/{serverId}/{channelId}`

```json
{
  "channelId": "string (自動生成)",
  "serverId": "string (所属サーバー)",
  "name": "string (チャンネル名)",
  "type": "text | voice (将来的に)",
  "createdAt": "number (timestamp)",
  "createdBy": "string (作成者のuid)"
}
```

---

## messages テーブル
**パス:** `/messages/{serverId}/{channelId}/{messageId}`

```json
{
  "messageId": "string (自動生成)",
  "userId": "string (送信者のuid)",
  "username": "string (送信時の名前)",
  "iconUrl": "string (送信時のアイコン)",
  "text": "string (メッセージ本文)",
  "timestamp": "number (送信時刻)",
  "reactions": {
    "emoji": ["uid1", "uid2"]
  }
}
```

---

## 既存データとの互換性

### 現在の rooms (Room1-Room10)
既存の固定ルームは削除せず、サーバー機能と並行して動作させる。
将来的には「パブリックサーバー」として統合可能。

### 現在の messages
パス `/messages/{roomId}` は維持。
新しいサーバーのメッセージは `/messages/{serverId}/{channelId}` に格納。