import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // GitHubからのPushイベントかどうかをヘッダーで判定
  const githubEvent = req.headers.get("x-github-event");
  if (githubEvent !== "push") {
    return new Response("Not a push event", { status: 200 });
  }

  try {
    const payload = await req.json();
    
    // 今回のPushに含まれるコミット数を取得
    const newCommitsCount = payload.commits ? payload.commits.length : 0;
    if (newCommitsCount === 0) {
      return new Response("No commits", { status: 200 });
    }

    // 環境変数からSupabaseにアクセス（管理者権限でデータベースを書き換え）
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 現在のコミット数を取得
    const { data: currentData } = await supabaseAdmin
      .from('app_metadata')
      .select('commit_count')
      .eq('id', 1)
      .single();

    const currentCount = currentData?.commit_count || 0;

    // 足し算してデータベースを更新
    await supabaseAdmin
      .from('app_metadata')
      .update({ commit_count: currentCount + newCommitsCount })
      .eq('id', 1);

    return new Response("Commit count updated successfully", { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})