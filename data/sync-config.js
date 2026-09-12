// data/sync-config.js — 跨裝置同步設定（Supabase）
// 🖊️ 把 Supabase Dashboard → Project Settings → API 裡的兩個值貼進來：
//   url     = Project URL（像 https://abcdefghijk.supabase.co）
//   anonKey = anon public key（很長的一串，以 eyJ 開頭；這是公開金鑰，放在網頁裡是正常的）
// 兩個都留空 = 不啟用同步，網站照常只存在本機。
// 本機離線測試：先跑 node sync/mock-supabase.mjs，再暫時填 url: 'http://localhost:54321', anonKey: 'mock'
window.NIHONGO_SYNC = {
  url: 'https://hpxnxkelugobbekvnsfi.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhweG54a2VsdWdvYmJla3Zuc2ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMTE3NTEsImV4cCI6MjEwNDc4Nzc1MX0.Di8Z4fKXAYlcJCSJt22bLJlerKI0x-OmIf3-G9HsufQ',
};
