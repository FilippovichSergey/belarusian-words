-- Міграцыя для штодзённай сінхранізацыі з Telegram.
-- Выканайце адзін раз у Supabase: SQL Editor -> New query -> Run.
-- Паўторны запуск бяспечны. Тое самае ўжо ўключана ў supabase/schema.sql.

alter table public.words add column if not exists status text not null default 'published';
alter table public.words add column if not exists source text;
alter table public.words add column if not exists source_url text;

alter table public.words drop constraint if exists words_status_check;
alter table public.words add constraint words_status_check
  check (status in ('draft', 'published'));

create index if not exists words_status_idx on public.words (status, created_at desc);

-- Чарнавікі бачыць толькі аўтарызаваны карыстальнік
drop policy if exists "words: public read" on public.words;
create policy "words: public read"
  on public.words for select
  using (status = 'published');

drop policy if exists "words: auth read" on public.words;
create policy "words: auth read"
  on public.words for select
  to authenticated using (true);

-- Нумар апошняга апрацаванага паста ў кожным канале.
-- Палітык няма, таму табліца даступная толькі скрыпту з ключом service_role.
create table if not exists public.telegram_sync (
  channel       text primary key,
  last_post_id  integer not null,
  updated_at    timestamptz not null default now()
);
alter table public.telegram_sync enable row level security;
