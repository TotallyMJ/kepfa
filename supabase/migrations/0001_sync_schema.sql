-- Kepfa cloud sync: one row per kept sky (blobs live in Storage), one profile per user.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  stamps jsonb,
  saved_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- id is the client-generated id (crypto.randomUUID or a short fallback), so keep it text.
create table public.skies (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null,
  note text not null default '',
  place text not null default '',
  prompt text not null default '',
  prompt_text text not null default '',
  palette jsonb,
  front boolean not null default false,
  has_live boolean not null default false,
  photo_path text,
  thumb_path text,
  live_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index skies_user_updated on public.skies (user_id, updated_at);

alter table public.profiles enable row level security;
alter table public.skies enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "own skies" on public.skies
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Give every new user a profile row.
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
