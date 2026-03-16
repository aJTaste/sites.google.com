DO $$
DECLARE
  TARGET_ID uuid := 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
BEGIN
  -- 1. 界隈メンバーシップ削除
  DELETE FROM community_members WHERE user_id=TARGET_ID;

  -- 2. チャンネルメッセージ削除
  DELETE FROM channel_messages WHERE sender_id=TARGET_ID;

  -- 3. DMメッセージ削除
  DELETE FROM dm_messages WHERE sender_id=TARGET_ID;

  -- 4. プロフィール削除
  DELETE FROM profiles WHERE id=TARGET_ID;

  -- 5. 認証ユーザー削除（auth スキーマ）
  DELETE FROM auth.users WHERE id=TARGET_ID;

  RAISE NOTICE '削除完了: %', TARGET_ID;
END $$;