begin;
create extension if not exists pgtap with schema extensions;
select plan(62);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
 ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@circle.test', '', now(), now(), now()),
 ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@circle.test', '', now(), now(), now()),
 ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@circle.test', '', now(), now(), now());

insert into public.cafes (id, provider_place_id, name, lat, lng)
values ('10000000-0000-4000-8000-000000000001', 'provider:test', 'Test cafe', 14.4, 120.9);

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.create_circle('Circle A', null)$$, 'owner creates A');
select lives_ok($$select public.create_circle('Circle B', null)$$, 'owner creates B');
select is((select count(*)::integer from public.groups), 2, 'owner sees A and B');
select is((select count(*)::integer from public.group_members where role='owner'), 2, 'creator owns both');
select set_config('test.circle_a_code', (select invite_code from public.groups where name='Circle A'), true);
select set_config('test.circle_a_id', (select id::text from public.groups where name='Circle A'), true);
select set_config('test.circle_b_id', (select id::text from public.groups where name='Circle B'), true);
select lives_ok(format('select public.create_circle_visit(%L::jsonb)', jsonb_build_object('groupId',(select id from public.groups where name='Circle A'),'cafeId','10000000-0000-4000-8000-000000000001','visitedAt','2026-10-16','rating',5,'participants',jsonb_build_array(auth.uid()),'photos',jsonb_build_array())::text), 'visit in A is atomic');
select lives_ok(format('select public.create_circle_visit(%L::jsonb)', jsonb_build_object('groupId',(select id from public.groups where name='Circle B'),'cafeId','10000000-0000-4000-8000-000000000001','visitedAt','2026-10-16','rating',0,'participants',jsonb_build_array(auth.uid()),'photos',jsonb_build_array())::text), 'visit in B is separate');
select is((select s.rating from public.groups g cross join lateral public.circle_cafe_summaries(g.id) s where g.name='Circle A'),5.0::numeric,'A rating is scoped');
select is((select s.rating from public.groups g cross join lateral public.circle_cafe_summaries(g.id) s where g.name='Circle B'),0.0::numeric,'B includes a zero rating');
select throws_ok(format('select public.create_circle_visit(%L::jsonb)',jsonb_build_object('groupId',(select id from public.groups where name='Circle A'),'cafeId','10000000-0000-4000-8000-000000000001','visitedAt','2026-10-16','participants',jsonb_build_array('00000000-0000-4000-8000-000000000003'),'photos',jsonb_build_array())::text),'22023',null,'outsider participant rejected');
select is((select count(*)::integer from public.visits),2,'invalid visit leaves no partial row');
insert into public.cafe_interests(group_id,cafe_id,user_id)
select id,'10000000-0000-4000-8000-000000000001',auth.uid() from public.groups;
insert into public.group_saved_cafes(group_id,cafe_id,saved_by)
select id,'10000000-0000-4000-8000-000000000001',auth.uid() from public.groups;
insert into public.circle_cafe_hours(group_id,cafe_id,day_of_week,open_time,close_time,submitted_by)
select id,'10000000-0000-4000-8000-000000000001',1,'08:00','18:00',auth.uid() from public.groups;
reset role;
insert into public.visit_photos(visit_id,uploaded_by,storage_path)
select id,
  case when group_id=current_setting('test.circle_a_id')::uuid
    then '00000000-0000-4000-8000-000000000002'::uuid
    else '00000000-0000-4000-8000-000000000001'::uuid end,
  (case when group_id=current_setting('test.circle_a_id')::uuid
    then '00000000-0000-4000-8000-000000000002'
    else '00000000-0000-4000-8000-000000000001' end) || '/' || id::text || '.jpg'
from public.visits;
insert into storage.objects(bucket_id,name,owner_id)
select 'visit-photos',storage_path,uploaded_by::text from public.visit_photos;
set local role authenticated;
select set_config('test.circle_a_photo', (select p.storage_path from public.visit_photos p join public.visits v on v.id=p.visit_id where v.group_id=current_setting('test.circle_a_id')::uuid), true);
select set_config('test.circle_b_photo', (select p.storage_path from public.visit_photos p join public.visits v on v.id=p.visit_id where v.group_id=current_setting('test.circle_b_id')::uuid), true);
select throws_ok($$insert into public.group_members(group_id,user_id,role) values ((select id from public.groups limit 1), auth.uid(), 'admin')$$, '42501', null, 'direct role escalation denied');
select throws_ok($$insert into public.cafes(provider_place_id,name,lat,lng) values ('evil','evil',0,0)$$, '42501', null, 'canonical cafe writes denied');
select ok(not has_table_privilege('authenticated','public.cafes','INSERT'), 'authenticated has no cafe write grant');
select is((select public from storage.buckets where id='visit-photos'), false, 'visit bucket is private');
select lives_ok($$insert into public.saved_cafes(user_id,cafe_id) values (auth.uid(),'10000000-0000-4000-8000-000000000001')$$, 'personal save works');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.groups), 0, 'nonmember cannot enumerate circles');
select is((select count(*)::integer from public.saved_cafes), 0, 'personal saves are private');
select throws_ok($$select public.join_circle('BAD999')$$, '22023', null, 'invalid invite rejected');
select lives_ok(format('select public.join_circle(%L)', current_setting('test.circle_a_code')), 'member joins A');
select lives_ok(format('select public.join_circle(%L)', current_setting('test.circle_a_code')), 'join is idempotent');
select lives_ok($$insert into public.cafe_interests(group_id,cafe_id,user_id) values(current_setting('test.circle_a_id')::uuid,'10000000-0000-4000-8000-000000000001',auth.uid())$$,'member interest is Circle-scoped');
select lives_ok($$update public.circle_cafe_hours set open_time='09:00',submitted_by=auth.uid() where group_id=current_setting('test.circle_a_id')::uuid$$,'member can revise shared hours');
select is((select open_time from public.circle_cafe_hours where group_id=current_setting('test.circle_a_id')::uuid),'09:00'::time,'shared hours reflect member edit');
select is((select count(*)::integer from public.groups), 1, 'member sees only A');
select is((select count(*)::integer from public.group_members), 2, 'member sees only A members');
select is((select count(*)::integer from public.group_members where role='member' and user_id=auth.uid()), 1, 'invitation grants member only');
select is((select count(*)::integer from public.visits), 1, 'member sees only A visit');
select is((select count(*)::integer from public.visit_participants), 1, 'member sees only A participants');
select is((select count(*)::integer from public.visit_photos), 1, 'member sees only A photo metadata');
select ok(public.can_read_visit_photo(current_setting('test.circle_a_photo')), 'member can read attached photo bytes');
select is((select count(*)::integer from storage.objects where bucket_id='visit-photos' and name=current_setting('test.circle_a_photo')),1,'member sees attached storage object');
select is((select count(*)::integer from public.activities), 4, 'member sees only A activity');
select is((select count(*)::integer from public.cafe_interests), 2, 'member sees only A interests');
select is((select count(*)::integer from public.group_saved_cafes), 1, 'member sees only A shared saves');
select is((select count(*)::integer from public.circle_cafe_hours), 1, 'member sees only A hours');
select throws_ok(format('select public.create_circle_visit(%L::jsonb)', jsonb_build_object('groupId','00000000-0000-0000-0000-000000000000','cafeId','10000000-0000-4000-8000-000000000001','visitedAt','2026-10-16','participants',jsonb_build_array(),'photos',jsonb_build_array())::text), '42501', null, 'member cannot write a different Circle');
select throws_ok(format('select public.delete_circle(%L::uuid)', current_setting('test.circle_a_id')), '42501', null, 'member cannot delete A');
select throws_ok($$delete from public.group_members where user_id=auth.uid()$$, '42501', null, 'direct membership deletion denied');
select lives_ok(format('select public.leave_circle(%L::uuid)',current_setting('test.circle_a_id')),'member leaves A');
select is((select count(*)::integer from public.group_members),0,'former member sees no memberships');
select ok(not public.can_read_visit_photo(current_setting('test.circle_a_photo')),'former uploader loses attached bytes');
select is((with removed as (delete from storage.objects where bucket_id='visit-photos' and name=current_setting('test.circle_a_photo') returning id) select count(*)::integer from removed),0,'former uploader cannot delete attached object');
reset role;
select is((select count(*)::integer from storage.objects where bucket_id='visit-photos' and name=current_setting('test.circle_a_photo')),1,'attached object survives former uploader delete');
set local role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.cafe_interests where group_id=current_setting('test.circle_a_id')::uuid),1,'leaving removes only departed member interest');
select is((select cardinality(s.interested_members) from public.circle_cafe_summaries(current_setting('test.circle_a_id')::uuid) s),1,'summary removes departed member interest');
select lives_ok($$update public.circle_cafe_hours set open_time='10:00',submitted_by=auth.uid() where group_id=current_setting('test.circle_a_id')::uuid$$,'owner can revise hours after editor leaves');
select is((select open_time from public.circle_cafe_hours where group_id=current_setting('test.circle_a_id')::uuid),'10:00'::time,'shared hours persist after editor leaves');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.groups), 0, 'outsider sees no groups');
select is((select count(*)::integer from public.group_members), 0, 'outsider sees no membership');
select is((select count(*)::integer from public.visits), 0, 'outsider sees no visits');
select is((select count(*)::integer from public.visit_participants), 0, 'outsider sees no participants');
select is((select count(*)::integer from public.visit_photos), 0, 'outsider sees no photo metadata');
select ok(not public.can_read_visit_photo(current_setting('test.circle_a_photo')), 'outsider cannot read attached photo bytes');
select is((select count(*)::integer from storage.objects where bucket_id='visit-photos' and name=current_setting('test.circle_a_photo')),0,'outsider cannot read storage object');
select is((select count(*)::integer from public.activities), 0, 'outsider sees no activity');
select is((select count(*)::integer from public.cafe_interests), 0, 'outsider sees no interests');
select is((select count(*)::integer from public.group_saved_cafes), 0, 'outsider sees no shared saves');
select is((select count(*)::integer from public.circle_cafe_hours), 0, 'outsider sees no hours');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select throws_ok(format('select public.leave_circle(%L::uuid)',current_setting('test.circle_a_id')),'42501',null,'owner cannot leave A');
select lives_ok(format('select public.delete_circle(%L::uuid)',current_setting('test.circle_b_id')),'owner deletes B');
select is((select count(*)::integer from public.groups),1,'deleting B preserves A');
select ok(not public.can_read_visit_photo(current_setting('test.circle_b_photo')),'deleted Circle photo cannot become a temporary upload');

select * from finish();
rollback;
