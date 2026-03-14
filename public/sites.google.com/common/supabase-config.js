// Supabase設定// 修正後（バージョン固定）
import{createClient}from'https://esm.sh/@supabase/supabase-js@2.49.1';

const SUPABASE_URL='https://hkdwcsosegaymdknpwon.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZHdjc29zZWdheW1ka25wd29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3Nzg1MzksImV4cCI6MjA4MjM1NDUzOX0.skOtXVh0EjgyxfWjKCeZp5lYxP0kVHv4qymdntpiUX4';

export const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
  auth:{
    autoRefreshToken:true,
    persistSession:true,
    detectSessionInUrl:true
  },
  realtime:{
    params:{
      eventsPerSecond:10
    }
  }
});