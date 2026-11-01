create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  join_code text not null unique check (join_code = upper(join_code)),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id),
  display_name text not null check (char_length(trim(display_name)) > 0),
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_family_id on public.profiles(family_id);

create table if not exists public.chore_catalog (
  id uuid primary key default gen_random_uuid(),
  source_sheet text not null default '家务LIST',
  category_name text not null,
  source_row_no integer not null check (source_row_no > 0),
  name text not null,
  raw_label text not null,
  frequency_code text check (
    frequency_code in ('D', 'W', '2W', 'M', 'L', '6M') or
    frequency_code ~ '^GL-[0-9]+(-[0-9]+)*$'
  ),
  sort_order integer not null check (sort_order > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chore_catalog_source_identity unique (source_sheet, category_name, source_row_no)
);

create index if not exists idx_chore_catalog_category_sort
  on public.chore_catalog(category_name, sort_order)
  where is_active = true;

drop trigger if exists trg_chore_catalog_updated_at on public.chore_catalog;
create trigger trg_chore_catalog_updated_at
before update on public.chore_catalog
for each row
execute function public.set_row_updated_at();

create table if not exists public.chore_completion_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  user_id uuid not null references public.profiles(id),
  chore_id uuid references public.chore_catalog(id) on delete set null,
  chore_name_snapshot text not null default '',
  category_name_snapshot text not null default '',
  frequency_code_snapshot text check (
    frequency_code_snapshot in ('D', 'W', '2W', 'M', 'L', '6M') or
    frequency_code_snapshot ~ '^GL-[0-9]+(-[0-9]+)*$'
  ),
  completed_on date not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_completion_records_family_date
  on public.chore_completion_records(family_id, completed_on desc);

create index if not exists idx_completion_records_user_date
  on public.chore_completion_records(user_id, completed_on desc);

create index if not exists idx_completion_records_family_completed_at
  on public.chore_completion_records(family_id, completed_at desc, id desc);

alter table public.chore_catalog
  drop constraint if exists chore_catalog_frequency_code_check;

alter table public.chore_catalog
  add constraint chore_catalog_frequency_code_check check (
    frequency_code in ('D', 'W', '2W', 'M', 'L', '6M') or
    frequency_code ~ '^GL-[0-9]+(-[0-9]+)*$'
  ) not valid;

alter table public.chore_completion_records
  drop constraint if exists chore_completion_records_frequency_code_snapshot_check;

alter table public.chore_completion_records
  add constraint chore_completion_records_frequency_code_snapshot_check check (
    frequency_code_snapshot in ('D', 'W', '2W', 'M', 'L', '6M') or
    frequency_code_snapshot ~ '^GL-[0-9]+(-[0-9]+)*$'
  ) not valid;

create table if not exists public.household_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  category_type text not null check (category_type in ('consumable', 'regular')),
  name text not null check (char_length(trim(name)) > 0),
  quantity integer,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_items_quantity_rule check (
    (category_type = 'consumable' and quantity is not null and quantity >= 0) or
    (category_type = 'regular' and quantity is null)
  )
);

create index if not exists idx_household_items_family_category_active
  on public.household_items(family_id, category_type, is_active);

create unique index if not exists idx_household_items_unique_active_name
  on public.household_items(family_id, category_type, lower(btrim(name)))
  where is_active = true;

drop trigger if exists trg_household_items_updated_at on public.household_items;
create trigger trg_household_items_updated_at
before update on public.household_items
for each row
execute function public.set_row_updated_at();

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  name text not null check (char_length(trim(name)) > 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pets_id_family_unique unique (id, family_id)
);

create index if not exists idx_pets_family_active
  on public.pets(family_id, is_active, created_at);

drop trigger if exists trg_pets_updated_at on public.pets;
create trigger trg_pets_updated_at
before update on public.pets
for each row
execute function public.set_row_updated_at();

create table if not exists public.pet_health_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  pet_id uuid not null,
  metric_type text not null check (metric_type in ('weight', 'urine', 'stool')),
  value numeric(8, 2) not null,
  recorded_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint pet_health_records_pet_family_fk
    foreign key (pet_id, family_id) references public.pets(id, family_id) on delete restrict,
  constraint pet_health_records_value_check check (
    (metric_type = 'weight' and value > 0) or
    (metric_type in ('urine', 'stool') and value between 0 and 99 and value = trunc(value))
  )
);

alter table public.pet_health_records
  drop constraint if exists pet_health_records_value_check;
alter table public.pet_health_records
  add constraint pet_health_records_value_check check (
    (metric_type = 'weight' and value > 0) or
    (metric_type in ('urine', 'stool') and value between 0 and 99 and value = trunc(value))
  ) not valid;

do $$
begin
  if not exists (
    select 1
    from public.pet_health_records
    where not (
      (metric_type = 'weight' and value > 0) or
      (metric_type in ('urine', 'stool') and value between 0 and 99 and value = trunc(value))
    )
  ) then
    alter table public.pet_health_records
      validate constraint pet_health_records_value_check;
  end if;
end;
$$;

create index if not exists idx_pet_health_records_family_pet_time
  on public.pet_health_records(family_id, pet_id, recorded_at desc);

create table if not exists public.temporary_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  title text not null check (char_length(trim(title)) > 0),
  content text not null default '',
  tag_color text not null,
  is_completed boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint temporary_events_family_color_unique unique (family_id, tag_color)
);

alter table public.temporary_events
  add column if not exists is_completed boolean not null default false;

create index if not exists idx_temporary_events_family_created
  on public.temporary_events(family_id, created_at desc);

drop trigger if exists trg_temporary_events_updated_at on public.temporary_events;
create trigger trg_temporary_events_updated_at
before update on public.temporary_events
for each row
execute function public.set_row_updated_at();

create table if not exists public.source_import_runs (
  id bigint generated always as identity primary key,
  source_file_name text not null,
  total_items integer not null check (total_items >= 0),
  inserted_count integer not null check (inserted_count >= 0),
  updated_count integer not null check (updated_count >= 0),
  inactivated_count integer not null check (inactivated_count >= 0),
  imported_at timestamptz not null default now()
);

create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  code_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  generated text := '';
begin
  for i in 1..6 loop
    generated := generated || substr(code_chars, 1 + floor(random() * length(code_chars))::integer, 1);
  end loop;

  return generated;
end;
$$;

create or replace function public.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.profiles where id = auth.uid();
$$;

create or replace function public.get_completion_record_stats(
  p_family_id uuid,
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_family_id is distinct from public.my_family_id() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return (
    with filtered_records as materialized (
      select user_id, category_name_snapshot, completed_on, completed_at
      from public.chore_completion_records
      where family_id = p_family_id
        and (p_start_date is null or completed_on >= p_start_date)
        and (p_end_date is null or completed_on <= p_end_date)
    ),
    member_stats as (
      select
        p.id as user_id,
        p.display_name,
        count(fr.user_id)::bigint as total_count,
        max(fr.completed_at) as latest_completed_at,
        coalesce(
          (
            select jsonb_object_agg(category_counts.category_name_snapshot, category_counts.total)
            from (
              select fr_category.category_name_snapshot, count(*)::bigint as total
              from filtered_records fr_category
              where fr_category.user_id = p.id
              group by fr_category.category_name_snapshot
            ) category_counts
          ),
          '{}'::jsonb
        ) as category_counts
      from public.profiles p
      left join filtered_records fr on fr.user_id = p.id
      where p.family_id = p_family_id
      group by p.id, p.display_name, p.created_at
    ),
    daily_checkins as (
      select user_id, completed_on, min(completed_at) as first_completed_at
      from filtered_records
      group by user_id, completed_on
    )
    select jsonb_build_object(
      'members', coalesce(
        (select jsonb_agg(jsonb_build_object(
          'user_id', user_id,
          'display_name', display_name,
          'total_count', total_count,
          'latest_completed_at', latest_completed_at,
          'category_counts', category_counts
        ) order by total_count desc, display_name asc) from member_stats),
        '[]'::jsonb
      ),
      'daily_checkins', coalesce(
        (select jsonb_agg(jsonb_build_object(
          'user_id', user_id,
          'completed_on', completed_on,
          'first_completed_at', first_completed_at
        ) order by completed_on desc, first_completed_at asc) from daily_checkins),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.get_completion_record_stats(uuid, date, date) from public;
grant execute on function public.get_completion_record_stats(uuid, date, date) to authenticated;

create or replace function public.create_family_with_profile(p_family_name text, p_display_name text)
returns table (family_id uuid, family_name text, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_family_id uuid;
  created_join_code text;
begin
  if current_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if exists (select 1 from public.profiles where id = current_user_id) then
    raise exception 'PROFILE_ALREADY_EXISTS';
  end if;

  loop
    created_join_code := public.generate_join_code();
    begin
      insert into public.families(name, join_code, created_by)
      values (trim(p_family_name), created_join_code, current_user_id)
      returning id into created_family_id;
      exit;
    exception
      when unique_violation then
        created_join_code := null;
    end;
  end loop;

  insert into public.profiles(id, family_id, display_name, role)
  values (current_user_id, created_family_id, trim(p_display_name), 'owner');

  return query
  select created_family_id, trim(p_family_name), created_join_code;
end;
$$;

create or replace function public.join_family_with_profile(p_join_code text, p_display_name text)
returns table (family_id uuid, family_name text, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_family public.families%rowtype;
begin
  if current_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if exists (select 1 from public.profiles where id = current_user_id) then
    raise exception 'PROFILE_ALREADY_EXISTS';
  end if;

  select f.*
  into target_family
  from public.families f
  where f.join_code = upper(trim(p_join_code));

  if not found then
    raise exception 'INVALID_JOIN_CODE';
  end if;

  insert into public.profiles(id, family_id, display_name, role)
  values (current_user_id, target_family.id, trim(p_display_name), 'member');

  return query
  select target_family.id, target_family.name, target_family.join_code;
end;
$$;

create or replace function public.set_completion_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_family_id uuid := public.my_family_id();
  selected_chore public.chore_catalog%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.family_id is null then
    new.family_id := current_family_id;
  end if;

  if new.user_id <> auth.uid() then
    raise exception 'INVALID_USER';
  end if;

  if new.family_id is distinct from current_family_id then
    raise exception 'INVALID_FAMILY';
  end if;

  if new.chore_id is null then
    if char_length(trim(coalesce(new.chore_name_snapshot, ''))) = 0 then
      raise exception 'CUSTOM_CHORE_NAME_REQUIRED';
    end if;

    if char_length(trim(coalesce(new.category_name_snapshot, ''))) = 0 then
      new.category_name_snapshot := '自定义';
    end if;

    new.frequency_code_snapshot := null;
  else
    select *
    into selected_chore
    from public.chore_catalog
    where id = new.chore_id;

    if not found then
      raise exception 'CHORE_NOT_FOUND';
    end if;

    new.chore_name_snapshot := selected_chore.name;
    new.category_name_snapshot := selected_chore.category_name;
    new.frequency_code_snapshot := selected_chore.frequency_code;
  end if;

  if new.completed_at is null then
    new.completed_at := now();
  end if;

  if new.completed_on is null then
    new.completed_on := (new.completed_at at time zone 'Asia/Shanghai')::date;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_completion_snapshot on public.chore_completion_records;
create trigger trg_completion_snapshot
before insert on public.chore_completion_records
for each row
execute function public.set_completion_snapshot();

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.chore_catalog enable row level security;
alter table public.chore_completion_records enable row level security;
alter table public.household_items enable row level security;
alter table public.pets enable row level security;
alter table public.pet_health_records enable row level security;
alter table public.temporary_events enable row level security;
alter table public.source_import_runs enable row level security;

drop policy if exists "families_select_same_family" on public.families;
create policy "families_select_same_family"
on public.families
for select
to authenticated
using (id = public.my_family_id());

drop policy if exists "families_insert_authenticated" on public.families;
create policy "families_insert_authenticated"
on public.families
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "profiles_select_same_family" on public.profiles;
create policy "profiles_select_same_family"
on public.profiles
for select
to authenticated
using (family_id = public.my_family_id());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and family_id = public.my_family_id());

drop policy if exists "chore_catalog_select_active" on public.chore_catalog;
create policy "chore_catalog_select_active"
on public.chore_catalog
for select
to authenticated
using (is_active = true);

drop policy if exists "completion_records_select_same_family" on public.chore_completion_records;
create policy "completion_records_select_same_family"
on public.chore_completion_records
for select
to authenticated
using (family_id = public.my_family_id());

drop policy if exists "completion_records_insert_self" on public.chore_completion_records;
create policy "completion_records_insert_self"
on public.chore_completion_records
for insert
to authenticated
with check (user_id = auth.uid() and family_id = public.my_family_id());

drop policy if exists "completion_records_update_self" on public.chore_completion_records;
create policy "completion_records_update_self"
on public.chore_completion_records
for update
to authenticated
using (user_id = auth.uid() and family_id = public.my_family_id())
with check (user_id = auth.uid() and family_id = public.my_family_id());

drop policy if exists "completion_records_delete_self" on public.chore_completion_records;
create policy "completion_records_delete_self"
on public.chore_completion_records
for delete
to authenticated
using (user_id = auth.uid() and family_id = public.my_family_id());

drop policy if exists "household_items_select_same_family" on public.household_items;
create policy "household_items_select_same_family"
on public.household_items
for select
to authenticated
using (family_id = public.my_family_id());

drop policy if exists "household_items_insert_same_family" on public.household_items;
create policy "household_items_insert_same_family"
on public.household_items
for insert
to authenticated
with check (family_id = public.my_family_id() and created_by = auth.uid());

drop policy if exists "household_items_update_same_family" on public.household_items;
create policy "household_items_update_same_family"
on public.household_items
for update
to authenticated
using (family_id = public.my_family_id())
with check (family_id = public.my_family_id());

drop policy if exists "pets_select_same_family" on public.pets;
create policy "pets_select_same_family"
on public.pets
for select
to authenticated
using (family_id = public.my_family_id());

drop policy if exists "pets_insert_same_family" on public.pets;
create policy "pets_insert_same_family"
on public.pets
for insert
to authenticated
with check (family_id = public.my_family_id() and created_by = auth.uid());

drop policy if exists "pets_update_same_family" on public.pets;
create policy "pets_update_same_family"
on public.pets
for update
to authenticated
using (family_id = public.my_family_id())
with check (family_id = public.my_family_id());

drop policy if exists "pet_health_records_select_same_family" on public.pet_health_records;
create policy "pet_health_records_select_same_family"
on public.pet_health_records
for select
to authenticated
using (family_id = public.my_family_id());

drop policy if exists "pet_health_records_insert_same_family" on public.pet_health_records;
create policy "pet_health_records_insert_same_family"
on public.pet_health_records
for insert
to authenticated
with check (family_id = public.my_family_id() and created_by = auth.uid());

drop policy if exists "pet_health_records_update_same_family" on public.pet_health_records;
create policy "pet_health_records_update_same_family"
on public.pet_health_records
for update
to authenticated
using (family_id = public.my_family_id())
with check (family_id = public.my_family_id());

drop policy if exists "pet_health_records_delete_same_family" on public.pet_health_records;
create policy "pet_health_records_delete_same_family"
on public.pet_health_records
for delete
to authenticated
using (family_id = public.my_family_id());

drop policy if exists "temporary_events_select_same_family" on public.temporary_events;
create policy "temporary_events_select_same_family"
on public.temporary_events
for select
to authenticated
using (family_id = public.my_family_id());

drop policy if exists "temporary_events_insert_same_family" on public.temporary_events;
create policy "temporary_events_insert_same_family"
on public.temporary_events
for insert
to authenticated
with check (family_id = public.my_family_id() and created_by = auth.uid());

drop policy if exists "temporary_events_update_same_family" on public.temporary_events;
create policy "temporary_events_update_same_family"
on public.temporary_events
for update
to authenticated
using (family_id = public.my_family_id())
with check (family_id = public.my_family_id());

drop policy if exists "temporary_events_delete_same_family" on public.temporary_events;
create policy "temporary_events_delete_same_family"
on public.temporary_events
for delete
to authenticated
using (family_id = public.my_family_id());

revoke all on function public.create_family_with_profile(text, text) from public;
revoke all on function public.join_family_with_profile(text, text) from public;
grant execute on function public.create_family_with_profile(text, text) to authenticated;
grant execute on function public.join_family_with_profile(text, text) to authenticated;
