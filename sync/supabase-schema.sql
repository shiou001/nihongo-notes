-- にほんごノート 跨裝置進度同步 — Supabase 建表腳本
-- 在 Supabase Dashboard → SQL Editor → New query 貼上整份、按 Run。
-- 可重複執行（都是 if not exists / or replace）。

create extension if not exists pgcrypto with schema extensions;

-- 一列 = 一組同步碼的全部進度（JSON）
create table if not exists public.progress (
  code_hash  text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- 開 RLS 但不加任何 policy：anon 金鑰無法直接讀寫這張表，只能透過下面兩個函式。
alter table public.progress enable row level security;
revoke all on table public.progress from anon, authenticated;

-- 讀取：回傳該同步碼的資料，沒有就 null
create or replace function public.progress_get(p_code text)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select data from public.progress
  where code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex');
$$;

-- 寫入（整份覆蓋；合併在瀏覽器端做）。回傳伺服器時間。
create or replace function public.progress_put(p_code text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
declare ts timestamptz;
begin
  if length(p_code) < 12 then
    raise exception 'sync code too short';
  end if;
  if pg_column_size(p_data) > 512 * 1024 then
    raise exception 'progress payload too large';
  end if;
  insert into public.progress (code_hash, data, updated_at)
  values (encode(extensions.digest(p_code, 'sha256'), 'hex'), p_data, now())
  on conflict (code_hash) do update
    set data = excluded.data, updated_at = now()
  returning updated_at into ts;
  return ts;
end;
$$;

grant execute on function public.progress_get(text) to anon, authenticated;
grant execute on function public.progress_put(text, jsonb) to anon, authenticated;
