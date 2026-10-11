-- Схема базы для дадатку "Беларускія словы".
-- Выканайце гэты файл у Supabase: Dashboard -> SQL Editor -> New query -> Run.

create extension if not exists "pgcrypto";

-- Табліца слоў
create table if not exists public.words (
  id          uuid primary key default gen_random_uuid(),
  be          text not null,                 -- слова ці выраз па-беларуску (кірыліца)
  be_lat      text,                          -- той жа варыянт лацінкай
  en          text,                          -- пераклад на ангельскую
  ru          text,                          -- пераклад на рускую
  comment     text,                          -- камент, прыклад ужывання і г.д.
  image_path  text,                          -- шлях да файла ў bucket "images"
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Для існуючых установак: дадаць калонкі, калі іх яшчэ няма
alter table public.words add column if not exists be_lat text;
-- status: "published" бачаць усе, "draft" толькі аўтарызаваны карыстальнік
alter table public.words add column if not exists status text not null default 'published';
-- source: адкуль слова (напрыклад назва Telegram-канала), source_url: спасылка на пост
alter table public.words add column if not exists source text;
alter table public.words add column if not exists source_url text;

alter table public.words drop constraint if exists words_status_check;
alter table public.words add constraint words_status_check
  check (status in ('draft', 'published'));

create index if not exists words_created_at_idx on public.words (created_at desc);
create index if not exists words_be_idx on public.words (lower(be));
create index if not exists words_status_idx on public.words (status, created_at desc);

-- Аўтаматычнае абнаўленне updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists words_set_updated_at on public.words;
create trigger words_set_updated_at
  before update on public.words
  for each row execute function public.set_updated_at();

-- Row Level Security: апублікаваныя словы чытаюць усе, чарнавікі і запіс
-- даступныя толькі аўтарызаваным карыстальнікам
alter table public.words enable row level security;

drop policy if exists "words: public read" on public.words;
create policy "words: public read"
  on public.words for select
  using (status = 'published');

drop policy if exists "words: auth read" on public.words;
create policy "words: auth read"
  on public.words for select
  to authenticated using (true);

drop policy if exists "words: auth insert" on public.words;
create policy "words: auth insert"
  on public.words for insert
  to authenticated with check (true);

drop policy if exists "words: auth update" on public.words;
create policy "words: auth update"
  on public.words for update
  to authenticated using (true) with check (true);

drop policy if exists "words: auth delete" on public.words;
create policy "words: auth delete"
  on public.words for delete
  to authenticated using (true);

-- Стан сінхранізацыі з Telegram: нумар апошняга апрацаванага паста ў канале.
-- Палітык няма, таму табліца даступная толькі скрыпту з ключом service_role.
create table if not exists public.telegram_sync (
  channel       text primary key,
  last_post_id  integer not null,
  updated_at    timestamptz not null default now()
);
alter table public.telegram_sync enable row level security;

-- Сховішча малюнкаў: публічны bucket "images"
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images: public read" on storage.objects;
create policy "images: public read"
  on storage.objects for select
  using (bucket_id = 'images');

drop policy if exists "images: auth insert" on storage.objects;
create policy "images: auth insert"
  on storage.objects for insert
  to authenticated with check (bucket_id = 'images');

drop policy if exists "images: auth update" on storage.objects;
create policy "images: auth update"
  on storage.objects for update
  to authenticated using (bucket_id = 'images');

drop policy if exists "images: auth delete" on storage.objects;
create policy "images: auth delete"
  on storage.objects for delete
  to authenticated using (bucket_id = 'images');
