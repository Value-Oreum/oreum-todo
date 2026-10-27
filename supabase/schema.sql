-- Run once in Supabase SQL Editor. Does not insert credentials.
create table public.members (
 id uuid primary key references auth.users(id), email text unique not null,
 approved boolean not null default false, role text not null default 'member' check(role in ('admin','member'))
);
create or replace function public.enroll_member() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into members(id,email,approved,role) values(new.id,lower(new.email), lower(new.email) in ('eastsea.chae@gmail.com','unboundedvalue@gmail.com','echa.value@gmail.com'),case when lower(new.email)='eastsea.chae@gmail.com' then 'admin' else 'member' end);
 return new;
end $$;
create trigger enroll after insert on auth.users for each row execute function public.enroll_member();
create or replace function public.is_member() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from members where id=auth.uid() and approved)$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from members where id=auth.uid() and approved and role='admin')$$;
alter table members enable row level security;
create policy members_read on members for select to authenticated using(id=auth.uid() or public.is_member());
create policy members_approve on members for update to authenticated using(public.is_admin() and role<>'admin') with check(role='member');
grant select on members to authenticated;
revoke update on members from authenticated;
grant update(approved) on members to authenticated;
create table public.tasks(id uuid primary key, data jsonb not null, updated_at timestamptz not null default now());
alter table tasks enable row level security;
create policy task_read on tasks for select to authenticated using(public.is_member());
create policy task_insert on tasks for insert to authenticated with check(public.is_member());
create policy task_update on tasks for update to authenticated using(public.is_member()) with check(public.is_member());
-- No hard-delete policy. The data.deleted flag is a reversible soft delete.
create table public.task_events(id bigint generated always as identity primary key, task_id uuid not null references tasks(id), actor uuid, at timestamptz not null default now(), old_data jsonb, new_data jsonb not null);
alter table task_events enable row level security;
create policy event_read on task_events for select to authenticated using(public.is_member());
create or replace function public.guard_task() returns trigger language plpgsql security definer set search_path=public as $$
declare k text; actor_email text; note text; score_note text=''; client_history jsonb;
begin
 if new.data->>'title' is null or length(trim(new.data->>'title')) not between 1 and 160 then raise exception 'Task title is required (1–160 characters)'; end if;
 if new.id::text <> new.data->>'id' then raise exception 'Invalid task ID'; end if;
 foreach k in array array['importance','urgency','difficulty'] loop
  if coalesce(new.data->>k,'') !~ '^[1-5]$' then raise exception 'Invalid score'; end if;
 end loop;
 if not exists(select 1 from members where email=new.data->>'owner' and approved) then raise exception 'Owner must be an approved member'; end if;
 if jsonb_typeof(new.data->'description') is distinct from 'string' or length(new.data->>'description')>8000 then raise exception 'Invalid description'; end if;
 if jsonb_typeof(new.data->'company') is distinct from 'string' or length(new.data->>'company')>120 then raise exception 'Invalid company'; end if;
 if jsonb_typeof(new.data->'deleted') is distinct from 'boolean' or jsonb_typeof(new.data->'reminder') is distinct from 'boolean' then raise exception 'Invalid flags'; end if;
 if new.data->>'repeat_days' not in ('0','7','14','30') then raise exception 'Invalid recurrence'; end if;
 if new.data->>'reminder'='true' then
  if nullif(new.data->>'reminder_at','')::timestamptz is null then raise exception 'Reminder time required'; end if;
 end if;

 if new.data->>'status' not in ('예정','진행 중','회신 대기','보류','완료','드롭') then raise exception 'Invalid status'; end if;
 select email into actor_email from members where id=auth.uid();
 if tg_op='UPDATE' then
  if new.updated_at <= old.updated_at then raise exception '다른 사용자가 먼저 변경했습니다. 최신 내용을 열어 다시 저장해주세요.'; end if;
  new.data=jsonb_set(new.data,'{initial}',old.data->'initial');
  foreach k in array array['importance','urgency','difficulty'] loop
   if old.data->k is distinct from new.data->k then score_note=score_note||k||' '||(old.data->>k)||'→'||(new.data->>k)||' '; end if;
  end loop;
  client_history=new.data->'history';
  note=client_history->-1->>'text';
  if score_note<>'' and coalesce(note,'') not like '% · %' then raise exception 'Score changes require a reason'; end if;
  if score_note<>'' then note='기준 변경: '||score_note||' · '||split_part(note,' · ',2);
  elsif old.data->'deleted' is distinct from new.data->'deleted' then note=case when (new.data->>'deleted')::boolean then '휴지통 이동' else '업무 복원' end;
  else note='업무 수정 · 상태 '||(new.data->>'status'); end if;
  new.data=jsonb_set(new.data,'{history}',coalesce(old.data->'history','[]')||jsonb_build_array(jsonb_build_object('at',now(),'actor',coalesce(actor_email,'알림 시스템'),'text',note)));
 else
  new.data=jsonb_set(new.data,'{initial}',jsonb_build_object('importance',new.data->'importance','urgency',new.data->'urgency','difficulty',new.data->'difficulty'));
  new.data=jsonb_set(new.data,'{history}',jsonb_build_array(jsonb_build_object('at',now(),'actor',coalesce(actor_email,'시스템'),'text','업무 등록')));
 end if;
 new.updated_at=clock_timestamp();new.data=jsonb_set(new.data,'{updated_at}',to_jsonb(new.updated_at));return new;
end $$;
create trigger guard_task before insert or update on tasks for each row execute function public.guard_task();
create or replace function public.record_task_event() returns trigger language plpgsql security definer set search_path=public as $$begin insert into task_events(task_id,actor,old_data,new_data) values(new.id,auth.uid(),case when tg_op='UPDATE' then old.data else null end,new.data);return new;end $$;
create trigger record_task_event after insert or update on tasks for each row execute function public.record_task_event();
alter publication supabase_realtime add table public.tasks;
-- Server-only usage accounting. Atomic global locks prevent parallel budget overruns.
create table public.ai_usage(id bigint generated always as identity primary key, actor uuid not null, at timestamptz default now());
alter table ai_usage enable row level security;
create or replace function public.reserve_ai_call(actor uuid) returns boolean language plpgsql security definer set search_path=public as $$begin
 perform pg_advisory_xact_lock(41001);
 if (select count(*) from ai_usage where at>=date_trunc('month',now()))>=200 or (select count(*) from ai_usage where at>=date_trunc('day',now()) and ai_usage.actor=reserve_ai_call.actor)>=20 then return false; end if;
 insert into ai_usage(actor) values(actor);return true;
end $$;
create table public.reminder_jobs(id uuid primary key default gen_random_uuid(),task_id uuid not null references tasks(id), scheduled_at timestamptz not null, state text not null default 'processing' check(state in ('processing','sent','failed')), task jsonb not null, created_at timestamptz default now(), unique(task_id,scheduled_at));
alter table reminder_jobs enable row level security;
create policy reminder_read on reminder_jobs for select to authenticated using(public.is_member());
create or replace function public.claim_reminders() returns setof reminder_jobs language plpgsql security definer set search_path=public as $$
declare r record; remaining integer;
begin
 perform pg_advisory_xact_lock(41002);
 remaining=least(5,80-(select count(*) from reminder_jobs where created_at>=date_trunc('day',now())),1500-(select count(*) from reminder_jobs where created_at>=date_trunc('month',now())));
 if remaining<=0 then return; end if;
 for r in select * from tasks where data->>'reminder'='true' and data->>'deleted'='false' and data->>'status' not in ('완료','드롭') and nullif(data->>'reminder_at','')::timestamptz<=now() and exists(select 1 from members where approved and email=data->>'owner') and not exists(select 1 from reminder_jobs j where j.task_id=tasks.id and j.scheduled_at=(data->>'reminder_at')::timestamptz) order by (data->>'reminder_at')::timestamptz limit remaining loop
 return query insert into reminder_jobs(task_id,scheduled_at,task) values(r.id,(r.data->>'reminder_at')::timestamptz,r.data) returning *;
 end loop;
end $$;
create or replace function public.finish_reminder(job_id uuid,success boolean) returns void language plpgsql security definer set search_path=public as $$
declare job reminder_jobs; t tasks; next_time timestamptz; interval_days integer;
begin
 select * into job from reminder_jobs where id=job_id for update;
 if job.id is null or job.state<>'processing' then return;end if;
 update reminder_jobs set state=case when success then 'sent' else 'failed' end where id=job_id;
 if success then
 select * into t from tasks where id=job.task_id for update;
 if t.data->>'reminder_at' is distinct from job.task->>'reminder_at' then return; end if;
 interval_days=greatest(0,least(365,coalesce((t.data->>'repeat_days')::integer,0)));
 if interval_days>0 then
 next_time=greatest(job.scheduled_at,now())+make_interval(days=>interval_days);
 update tasks set data=jsonb_set(data,'{reminder_at}',to_jsonb(next_time)),updated_at=clock_timestamp() where id=t.id;
 else
 update tasks set data=jsonb_set(data,'{reminder}','false'),updated_at=clock_timestamp() where id=t.id;
 end if;
 end if;
end $$;
revoke execute on function public.reserve_ai_call(uuid),public.claim_reminders(),public.finish_reminder(uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_ai_call(uuid),public.claim_reminders(),public.finish_reminder(uuid,boolean) to service_role;
