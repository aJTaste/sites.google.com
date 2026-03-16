DO $$
DECLARE
  TARGET_ID uuid:='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
BEGIN
  DELETE FROM community_members WHERE user_id=TARGET_ID;
  DELETE FROM channel_messages WHERE sender_id=TARGET_ID;
  DELETE FROM dm_messages WHERE sender_id=TARGET_ID;
  DELETE FROM profiles WHERE id=TARGET_ID;
  DELETE FROM auth.users WHERE id=TARGET_ID;
  RAISE NOTICE '削除完了: %',TARGET_ID;
END $$;