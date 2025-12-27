// Supabase設定
import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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

// ランダムカラー生成（アバター用）
export function generateRandomColor(){
  const colors=[
    '#FF6B35','#0097A7','#8C52FF','#2DA44E',
    '#CF222E','#F97316','#10B981','#3B82F6',
    '#8B5CF6','#EC4899','#F59E0B','#14B8A6'
  ];
  return colors[Math.floor(Math.random()*colors.length)];
}
