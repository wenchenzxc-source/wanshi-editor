create or replace function public.wanshi_claim_drive_job(p_id text, p_lease_ms bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare claimed jsonb;
declare now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_lease_ms < 1000 or p_lease_ms > 600000 then
    raise exception 'invalid lease';
  end if;
  update public.wanshi_objects
     set value = jsonb_set(
       jsonb_set(
         jsonb_set(value, '{status}', '"working"'::jsonb, true),
         '{leaseUntil}', to_jsonb(now_ms + p_lease_ms), true),
       '{attempts}', to_jsonb(coalesce((value->>'attempts')::integer, 0) + 1), true),
       updated_at = now()
   where bucket = 'drive-jobs' and id = p_id
     and ((value->>'status' in ('queued', 'failed') and coalesce((value->>'nextRetryAt')::bigint, 0) <= now_ms)
       or (value->>'status' = 'working' and coalesce((value->>'leaseUntil')::bigint, 0) < now_ms))
  returning value into claimed;
  return claimed;
end;
$$;

revoke all on function public.wanshi_claim_drive_job(text, bigint) from public, anon, authenticated;
grant execute on function public.wanshi_claim_drive_job(text, bigint) to service_role;
