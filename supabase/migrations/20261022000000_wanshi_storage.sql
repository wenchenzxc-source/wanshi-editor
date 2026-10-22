create table if not exists public.wanshi_objects (
  bucket text not null,
  id text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (bucket, id),
  constraint wanshi_bucket_format check (bucket ~ '^[a-z-]+$'),
  constraint wanshi_id_format check (id ~ '^[a-zA-Z0-9-]+$')
);

alter table public.wanshi_objects enable row level security;
revoke all on table public.wanshi_objects from anon, authenticated;
grant select, insert, update, delete on table public.wanshi_objects to service_role;

create or replace function public.wanshi_compare_and_swap(
  p_id text,
  p_owner text,
  p_base_revision integer,
  p_value jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare changed integer;
begin
  update public.wanshi_objects
     set value = p_value, updated_at = now()
   where bucket = 'drafts'
     and id = p_id
     and value->>'owner' = p_owner
     and (value->>'revision')::integer = p_base_revision;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.wanshi_compare_and_swap(text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.wanshi_compare_and_swap(text, text, integer, jsonb) to service_role;

insert into storage.buckets (id, name, public)
values ('wanshi-private', 'wanshi-private', false)
on conflict (id) do update set public = false;

-- 不建立 anon/authenticated policy。所有資料均由 Vercel API 驗證私有 session 後，
-- 使用只存在伺服器環境變數的 Supabase secret key 存取。
