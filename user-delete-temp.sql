DO $$
DECLARE
  TARGET_USER_ID text:='';
  TARGET_UUID uuid;
BEGIN
  SELECT id INTO TARGET_UUID FROM profiles WHERE user_id=TARGET_USER_ID LIMIT 1;
  IF TARGET_UUID IS NULL THEN
    RAISE EXCEPTION 'アカウントID「%」が見つかりません',TARGET_USER_ID;
  END IF;
  DELETE FROM community_members WHERE user_id=TARGET_UUID;
  DELETE FROM channel_messages  WHERE sender_id=TARGET_UUID;
  DELETE FROM dm_messages       WHERE sender_id=TARGET_UUID;
  DELETE FROM profiles          WHERE id=TARGET_UUID;
  DELETE FROM auth.users        WHERE id=TARGET_UUID;
  RAISE NOTICE '削除完了: % (%)',TARGET_USER_ID,TARGET_UUID;
END $$;