# Беларускія словы

Асабісты слоўнік: беларускае слова ці выраз кірыліцай і лацінкай, пераклад на ангельскую і рускую, малюнак, камент і тэгі.

Стэк: Next.js 16 (App Router, Server Actions), Supabase (Postgres, Storage, Auth), Tailwind CSS 4, дэплой на Vercel.

## 1. Supabase

1. Стварыце праект на [supabase.com](https://supabase.com).
2. Адкрыйце **SQL Editor → New query**, устаўце змест файла `supabase/schema.sql` і націсніце **Run**. Гэта створыць табліцу `words`, bucket `images` і правілы доступу: чытаць могуць усе, пісаць толькі аўтарызаваныя.
3. (Неабавязкова) Тым жа спосабам выканайце `supabase/seed.sql`, каб дадаць пачатковыя словы.
4. **Authentication → Sign In / Providers → Email**: выключыце «Allow new users to sign up», каб ніхто не мог зарэгістравацца сам.
5. **Authentication → Users → Add user**: стварыце свой акаўнт з email і паролем (пазначце «Auto Confirm User»).
6. **Project Settings → API**: скапіруйце `Project URL` і публічны ключ (anon ці publishable).

## 2. Лакальны запуск

```bash
cp .env.example .env.local
```

Запоўніце `NEXT_PUBLIC_SUPABASE_URL` і `NEXT_PUBLIC_SUPABASE_ANON_KEY` у `.env.local`, потым:

```bash
npm install
npm run dev
```

Адкрыйце http://localhost:3000, увайдзіце і дадайце першае слова.

## 3. Дэплой на Vercel

1. Запушце праект у GitHub (ці GitLab/Bitbucket).
2. На [vercel.com](https://vercel.com) → **Add New → Project**, абярыце рэпазіторый.
3. У **Environment Variables** дадайце `NEXT_PUBLIC_SUPABASE_URL` і `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ключ `SUPABASE_SERVICE_ROLE_KEY` і `GEMINI_API_KEY` у Vercel дадаваць **не трэба**, яны патрэбныя толькі лакальнаму скрыпту.
4. Deploy. Далей кожны push у галоўную галіну дэплоіцца аўтаматычна.

## 4. Малюнкі

**Уручную.** Згенеруйце малюнак у дадатку Gemini (Nano Banana) ці ў Whisk, спампуйце і загрузіце праз форму слова.

**Аўтаматычна праз Gemini API.** Скрыпт бярэ словы без малюнка, генеруе ілюстрацыю ў адзіным стылі і захоўвае яе ў Supabase Storage.

1. Атрымайце ключ на https://aistudio.google.com/apikey. Увага: падпіска Gemini Pro не ўключае API, гэта асобны білінг з бясплатным лімітам.
2. У `.env.local` дадайце `GEMINI_API_KEY` і `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role). Гэты ключ дае поўны доступ да базы, не публікуйце яго.
3. Паглядзець промпты без генерацыі:

```bash
npm run generate-images -- 5 --dry-run
```

4. Згенераваць малюнкі для 5 слоў:

```bash
npm run generate-images -- 5
```

Стыль малюнкаў задаецца зменнай `IMAGE_STYLE` у `.env.local`, мадэль — `GEMINI_IMAGE_MODEL` (напрыклад `gemini-2.5-flash-image` ці `gemini-3-pro-image`).

## 5. Імпарт з Telegram

Скрыпт чытае HTML-экспарт канала, дзе кожнае паведамленне пачынаецца радком «Кірыліца / Lacinka / English / Русский». Тлумачэнне і цытата трапляюць у камент, дата паведамлення становіцца датай дадання, кожнае слова атрымлівае тэг `verbarium`. Паведамленні без такога радка прапускаюцца, а словы, якія ўжо ёсць у базе, не дублююцца.

```bash
npm run import-telegram -- words/messages2.html --dry-run
```

Калі ў `.env.local` ёсць `SUPABASE_SERVICE_ROLE_KEY`, скрыпт без `--dry-run` запісвае словы наўпрост у базу. Без ключа ён стварае побач SQL-файл, які трэба выканаць у Supabase SQL Editor.

Папка `words/` і файл `Словы.txt` не трапляюць у git.

## Структура

```
supabase/schema.sql            схема базы і палітыкі доступу
supabase/seed.sql              пачатковыя словы
src/proxy.ts                   абнаўленне сесіі, абарона старонак дадання і рэдагавання
src/lib/supabase/              кліенты Supabase для браўзера і сервера
src/lib/words.ts               запыты да табліцы words
src/app/page.tsx               спіс слоў з пошукам
src/app/words/[id]/page.tsx    старонка слова
src/app/words/new/page.tsx     дадаць слова
src/app/words/[id]/edit/       рэдагаваць слова
src/app/words/actions.ts       Server Actions: стварэнне, абнаўленне, выдаленне
src/app/login/                 уваход і выхад
src/components/WordForm.tsx    форма з загрузкай малюнка наўпрост у Storage
scripts/generate-images.ts     пакетная генерацыя малюнкаў праз Gemini
scripts/import-telegram.ts     імпарт слоў з экспарту Telegram
```
