# FAMILJ

> Full control of your week. Without stress.

A minimalist Scandinavian family planning app built with Expo + React Native.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK (React Native) + TypeScript |
| Navigation | Expo Router (file-based) |
| State | Zustand |
| Backend | Supabase (PostgreSQL + RLS) |
| i18n | i18next + react-i18next |
| Date/Time | date-fns + date-fns-tz |

---

## Getting Started

### 1. Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator
- A [Supabase](https://supabase.com) project

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase project URL and anon key:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Start the app

```bash
npx expo start
```

Press `i` for iOS simulator, `a` for Android, or scan the QR code with the Expo Go app.

---

## Project Structure

```
app/                         # Expo Router screens
├── _layout.tsx              # Root layout (i18n + auth init)
├── auth.tsx                 # Sign in / magic link screen
└── (tabs)/
    ├── _layout.tsx          # Tab bar
    ├── index.tsx            # Weekly view (home)
    └── settings.tsx         # Settings

src/
├── lib/
│   ├── time/index.ts        # ★ Centralized time utilities (DO NOT bypass)
│   ├── supabase.ts          # Supabase client
│   └── database.types.ts    # DB type definitions
├── stores/
│   ├── authStore.ts         # Auth + profile state
│   ├── familyStore.ts       # Family + members state
│   ├── eventStore.ts        # Events state + occurrence expansion
│   └── settingsStore.ts     # User preferences
├── locales/
│   ├── en/translation.json
│   ├── sv/translation.json
│   └── de/translation.json
├── features/                # Future feature modules
└── i18n.ts                  # i18next initialization
```

---

## Architecture Rules

### Time Handling (Critical)

> Calendar bugs break trust immediately. All time logic is treated with financial-system discipline.

- ✅ All timestamps stored in **UTC** in Supabase
- ✅ All rendering converts UTC → user's IANA timezone
- ✅ Recurring events expanded in memory (never duplicated in DB)
- ✅ DST-safe via `date-fns-tz`
- ❌ **Never manipulate raw `Date` objects in components**
- ❌ **Never bypass `src/lib/time/`**

### i18n Rules

- All UI strings go through `useTranslation()` — no hardcoded strings in components
- Language stored per user in Supabase profiles table
- Supported languages: English (`en`), Swedish (`sv`), German (`de`)

### Recurring Events Schema

```json
{
  "frequency": "weekly",
  "interval": 1,
  "byWeekday": ["TU"],
  "timezone": "Europe/Stockholm"
}
```

---

## Database Schema

Run the following SQL in your Supabase project (SQL Editor):

```sql
-- profiles
create table profiles (
  id uuid references auth.users primary key,
  language text default 'en',
  timezone text default 'UTC',
  locale text default 'en-US',
  week_start_preference smallint default 1,
  time_format_preference text default '24h',
  created_at timestamptz default now()
);

-- families
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users not null,
  created_at timestamptz default now()
);

-- members
create table members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families not null,
  name text not null,
  color text not null,
  role text not null check (role in ('parent', 'child'))
);

-- events
create table events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families not null,
  title text not null,
  start_time_utc timestamptz not null,
  end_time_utc timestamptz not null,
  timezone text not null,
  type text default 'activity' check (type in ('activity','homework','test','other')),
  recurrence_rule jsonb,
  member_ids uuid[] default '{}',
  reminder_minutes int,
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

-- subscriptions
create table subscriptions (
  user_id uuid references auth.users primary key,
  status text default 'active',
  plan text default 'free',
  expires_at timestamptz,
  platform text default 'ios'
);

-- RLS: enable row level security on all tables
alter table profiles enable row level security;
alter table families enable row level security;
alter table members enable row level security;
alter table events enable row level security;
alter table subscriptions enable row level security;
```

---

## Supported Languages

| Code | Language |
|------|----------|
| `en` | English |
| `sv` | Svenska |
| `de` | Deutsch |

---

## Build Order (from spec)

- [x] Core time utilities
- [x] Supabase client + DB types
- [x] i18n setup (en, sv, de)
- [x] Zustand stores (auth, family, events, settings)
- [x] Navigation (Expo Router)
- [x] Weekly view screen
- [x] Auth screen (magic link)
- [x] Settings screen
- [ ] Onboarding flow
- [ ] Event creation bottom sheet
- [ ] Recurring event engine (full UI)
- [ ] Push notifications
- [ ] Subscription system
- [ ] Premium feature gating
- [ ] App Store submission
