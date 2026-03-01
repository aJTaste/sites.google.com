


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."cleanup_old_typing_status"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM typing_status 
  WHERE updated_at < NOW() - INTERVAL '5 seconds';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_typing_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'user_id', NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."channel_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "text" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "text" "text",
    "image_url" "text",
    "reply_to_id" "uuid",
    "reply_to_text" "text",
    "reply_to_sender_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."channel_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dm_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dm_id" "text" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "text" "text",
    "image_url" "text",
    "reply_to_id" "uuid",
    "reply_to_text" "text",
    "reply_to_sender_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dm_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "filename" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "file_type" "text" NOT NULL,
    "description" "text",
    "is_moderator_only" boolean DEFAULT false,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid",
    "following_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "url" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "posted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "links_category_check" CHECK (("category" = ANY (ARRAY['game'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" DEFAULT ''::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "actor_id" "uuid",
    "type" "text" NOT NULL,
    "post_id" "uuid",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "text" "text",
    "media_urls" "text"[],
    "media_types" "text"[],
    "repost_of" "uuid",
    "quote_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "last_name" "text",
    "first_name" "text",
    "avatar_url" "text",
    "avatar_color" "text" DEFAULT '#FF6B35'::"text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_online" timestamp with time zone DEFAULT "now"(),
    "is_online" boolean DEFAULT false,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'moderator'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."read_status" (
    "user_id" "uuid" NOT NULL,
    "target_id" "text" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."read_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reposts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reposts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."typing_status" (
    "user_id" "uuid" NOT NULL,
    "target_id" "text" NOT NULL,
    "is_typing" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."typing_status" OWNER TO "postgres";


ALTER TABLE ONLY "public"."channel_messages"
    ADD CONSTRAINT "channel_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dm_messages"
    ADD CONSTRAINT "dm_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."links"
    ADD CONSTRAINT "links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."read_status"
    ADD CONSTRAINT "read_status_pkey" PRIMARY KEY ("user_id", "target_id");



ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."typing_status"
    ADD CONSTRAINT "typing_status_pkey" PRIMARY KEY ("user_id", "target_id");



CREATE INDEX "idx_channel_messages_channel_id" ON "public"."channel_messages" USING "btree" ("channel_id");



CREATE INDEX "idx_channel_messages_created_at" ON "public"."channel_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_channel_messages_sender_id" ON "public"."channel_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_comments_post_id" ON "public"."comments" USING "btree" ("post_id");



CREATE INDEX "idx_dm_messages_created_at" ON "public"."dm_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_dm_messages_dm_id" ON "public"."dm_messages" USING "btree" ("dm_id");



CREATE INDEX "idx_dm_messages_sender_id" ON "public"."dm_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_files_created_at" ON "public"."files" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_files_uploaded_by" ON "public"."files" USING "btree" ("uploaded_by");



CREATE INDEX "idx_follows_follower" ON "public"."follows" USING "btree" ("follower_id");



CREATE INDEX "idx_follows_following" ON "public"."follows" USING "btree" ("following_id");



CREATE INDEX "idx_likes_post_id" ON "public"."likes" USING "btree" ("post_id");



CREATE INDEX "idx_likes_user_id" ON "public"."likes" USING "btree" ("user_id");



CREATE INDEX "idx_links_created_at" ON "public"."links" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_links_posted_by" ON "public"."links" USING "btree" ("posted_by");



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_posts_created_at" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_user_id" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_read_status_target_id" ON "public"."read_status" USING "btree" ("target_id");



CREATE INDEX "idx_reposts_post_id" ON "public"."reposts" USING "btree" ("post_id");



CREATE INDEX "idx_typing_status_target_id" ON "public"."typing_status" USING "btree" ("target_id");



CREATE OR REPLACE TRIGGER "notes_updated_at" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_notes_updated_at"();



CREATE OR REPLACE TRIGGER "update_channel_messages_updated_at" BEFORE UPDATE ON "public"."channel_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_dm_messages_updated_at" BEFORE UPDATE ON "public"."dm_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_typing_status_updated_at" BEFORE UPDATE ON "public"."typing_status" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."channel_messages"
    ADD CONSTRAINT "channel_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."channel_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."channel_messages"
    ADD CONSTRAINT "channel_messages_reply_to_sender_id_fkey" FOREIGN KEY ("reply_to_sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."channel_messages"
    ADD CONSTRAINT "channel_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dm_messages"
    ADD CONSTRAINT "dm_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."dm_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dm_messages"
    ADD CONSTRAINT "dm_messages_reply_to_sender_id_fkey" FOREIGN KEY ("reply_to_sender_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."dm_messages"
    ADD CONSTRAINT "dm_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."likes"
    ADD CONSTRAINT "likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_repost_of_fkey" FOREIGN KEY ("repost_of") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."read_status"
    ADD CONSTRAINT "read_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reposts"
    ADD CONSTRAINT "reposts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."typing_status"
    ADD CONSTRAINT "typing_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Moderators can delete any files" ON "public"."files" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['moderator'::"text", 'admin'::"text"]))))));



CREATE POLICY "Moderators can delete any links" ON "public"."links" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['moderator'::"text", 'admin'::"text"]))))));



CREATE POLICY "Users can delete their own files" ON "public"."files" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Users can delete their own links" ON "public"."links" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "posted_by"));



CREATE POLICY "Users can insert own notes" ON "public"."notes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own files" ON "public"."files" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "Users can insert their own links" ON "public"."links" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "posted_by"));



CREATE POLICY "Users can manage their own read status" ON "public"."read_status" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notes" ON "public"."notes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view files" ON "public"."files" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view links" ON "public"."links" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view own notes" ON "public"."notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "channel_delete_policy" ON "public"."channel_messages" FOR DELETE USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "channel_insert_policy" ON "public"."channel_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (("channel_id" = ANY (ARRAY['general'::"text", 'random'::"text", 'tech'::"text"])) OR (("channel_id" = 'moderators'::"text") AND (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['moderator'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."channel_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_select_policy" ON "public"."channel_messages" FOR SELECT USING ((("channel_id" = ANY (ARRAY['general'::"text", 'random'::"text", 'tech'::"text"])) OR (("channel_id" = 'moderators'::"text") AND (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = ANY (ARRAY['moderator'::"text", 'admin'::"text"])))));



CREATE POLICY "channel_update_policy" ON "public"."channel_messages" FOR UPDATE USING (("auth"."uid"() = "sender_id"));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_delete_own" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "comments_insert_own" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "comments_select_all" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "comments_update_own" ON "public"."comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "dm_delete_policy" ON "public"."dm_messages" FOR DELETE USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "dm_insert_policy" ON "public"."dm_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



ALTER TABLE "public"."dm_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dm_select_policy" ON "public"."dm_messages" FOR SELECT USING (("dm_id" ~~ (('%'::"text" || ( SELECT "profiles"."user_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) || '%'::"text")));



CREATE POLICY "dm_update_policy" ON "public"."dm_messages" FOR UPDATE USING (("auth"."uid"() = "sender_id"));



ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "files_delete_policy" ON "public"."files" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "uploaded_by") OR ("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = ANY (ARRAY['moderator'::"text", 'admin'::"text"]))))));



CREATE POLICY "files_insert_policy" ON "public"."files" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "uploaded_by"));



CREATE POLICY "files_select_policy" ON "public"."files" FOR SELECT TO "authenticated" USING (((NOT "is_moderator_only") OR ("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = ANY (ARRAY['moderator'::"text", 'admin'::"text"]))))));



CREATE POLICY "files_update_policy" ON "public"."files" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "uploaded_by"));



ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "follows_delete_own" ON "public"."follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "follows_insert_own" ON "public"."follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "follows_select_all" ON "public"."follows" FOR SELECT USING (true);



ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "likes_delete_own" ON "public"."likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "likes_insert_own" ON "public"."likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "likes_select_all" ON "public"."likes" FOR SELECT USING (true);



ALTER TABLE "public"."links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_own" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_insert_any" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete_own" ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "posts_insert_own" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "posts_select_all" ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "posts_update_own" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read_all_policy" ON "public"."read_status" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."read_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reposts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reposts_delete_own" ON "public"."reposts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "reposts_insert_own" ON "public"."reposts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "reposts_select_all" ON "public"."reposts" FOR SELECT USING (true);



CREATE POLICY "typing_select_policy" ON "public"."typing_status" FOR SELECT USING (true);



ALTER TABLE "public"."typing_status" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "typing_upsert_policy" ON "public"."typing_status" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ログイン済みユーザーはファイルをアップロー" ON "public"."files" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "ログイン済みユーザーはリンクを投稿可能" ON "public"."links" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "全員がリンクを閲覧可能" ON "public"."links" FOR SELECT USING (true);



CREATE POLICY "全員が全プロフィールを閲覧可能" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "自分のプロフィールのみ更新可能" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."channel_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."dm_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."typing_status";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."cleanup_old_typing_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_typing_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_typing_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notes_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."channel_messages" TO "anon";
GRANT ALL ON TABLE "public"."channel_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_messages" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."dm_messages" TO "anon";
GRANT ALL ON TABLE "public"."dm_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_messages" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."likes" TO "anon";
GRANT ALL ON TABLE "public"."likes" TO "authenticated";
GRANT ALL ON TABLE "public"."likes" TO "service_role";



GRANT ALL ON TABLE "public"."links" TO "anon";
GRANT ALL ON TABLE "public"."links" TO "authenticated";
GRANT ALL ON TABLE "public"."links" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."read_status" TO "anon";
GRANT ALL ON TABLE "public"."read_status" TO "authenticated";
GRANT ALL ON TABLE "public"."read_status" TO "service_role";



GRANT ALL ON TABLE "public"."reposts" TO "anon";
GRANT ALL ON TABLE "public"."reposts" TO "authenticated";
GRANT ALL ON TABLE "public"."reposts" TO "service_role";



GRANT ALL ON TABLE "public"."typing_status" TO "anon";
GRANT ALL ON TABLE "public"."typing_status" TO "authenticated";
GRANT ALL ON TABLE "public"."typing_status" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































