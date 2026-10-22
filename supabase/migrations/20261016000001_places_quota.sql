create table public.places_quota_window (
  user_id uuid not null,
  route text not null check (route in ('search', 'details')),
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, route, window_start)
);
create index places_quota_window_expiry_idx on public.places_quota_window(window_start);
alter table public.places_quota_window enable row level security;
revoke all on table public.places_quota_window from public, anon, authenticated;

create function public.consume_places_quota(p_route text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  route_limit integer;
  clock_now timestamptz := clock_timestamp();
  minute_start timestamptz;
  used integer;
  retry_after integer;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_route = 'search' then
    route_limit := 30;
  elsif p_route = 'details' then
    route_limit := 60;
  else
    raise exception 'Invalid Places route' using errcode = '22023';
  end if;

  minute_start := date_trunc('minute', clock_now);
  delete from public.places_quota_window where window_start < minute_start - interval '5 minutes';

  insert into public.places_quota_window as quota (user_id, route, window_start, request_count)
  values (actor, p_route, minute_start, 1)
  on conflict (user_id, route, window_start) do update
    set request_count = quota.request_count + 1
    where quota.request_count < route_limit
  returning request_count into used;

  if used is not null then
    return jsonb_build_object('allowed', true, 'retryAfterSeconds', 0);
  end if;
  retry_after := greatest(1, ceil(extract(epoch from minute_start + interval '1 minute' - clock_now))::integer);
  return jsonb_build_object('allowed', false, 'retryAfterSeconds', retry_after);
end $$;
revoke all on function public.consume_places_quota(text) from public, anon;
grant execute on function public.consume_places_quota(text) to authenticated;
