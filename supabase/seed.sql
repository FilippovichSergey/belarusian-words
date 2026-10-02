-- Пачатковыя словы. Выканайце ў Supabase SQL Editor пасля schema.sql.
-- Паўторны запуск не стварае дублікатаў: слова прапускаецца, калі такое ўжо ёсць.

insert into public.words (be, be_lat, en, ru)
select 'Знíчка', 'Znička', 'Shooting star', 'Падающая звезда'
where not exists (select 1 from public.words where be = 'Знíчка');
