-- Doorway user profiles (role stored here, not in user_metadata)
-- Applied to project okcscebefyilfgnuolhz via Supabase MCP

create type public.doorway_role as enum ('SEEKER', 'LANDLORD');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  role public.doorway_role not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Signup trigger copies name + role from signup metadata into profiles (one-time; role is never read from JWT).
-- Passwords: stored only in auth.users by Supabase Auth (bcrypt). Never add passwords to public.profiles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    lower(trim(new.email)),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.doorway_role, 'SEEKER'::public.doorway_role)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Email lookup for account verification at login (security definer, read-only).

create or replace function public.lookup_profile_by_email(p_email text)
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role public.doorway_role
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.email, p.first_name, p.last_name, p.role
  from public.profiles p
  where lower(trim(p.email)) = lower(trim(p_email))
  limit 1;
$$;

revoke execute on function public.lookup_profile_by_email(text) from public;
grant execute on function public.lookup_profile_by_email(text) to anon, authenticated, service_role;
