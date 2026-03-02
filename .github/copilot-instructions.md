# FAMILJ – Copilot Instructions

## Project Overview
FAMILJ is a minimalist Scandinavian family planning app built with Expo + React Native (TypeScript). It features a weekly calendar view, recurring events, push notifications, and a freemium subscription model.

## Tech Stack
- **Frontend**: Expo SDK (React Native), TypeScript
- **State**: Zustand
- **Backend**: Supabase (PostgreSQL + RLS + Edge Functions)
- **i18n**: i18next + react-i18next
- **Date/Time**: date-fns + date-fns-tz
- **Navigation**: Expo Router

## Architecture Rules
- Feature-based folder structure under `src/features/`
- All time logic goes through `src/lib/time/` — never manipulate raw Date objects in components
- All UI strings must be externalized via i18next — no hardcoded strings in components
- TypeScript strict mode enabled
- All timestamps stored in UTC in Supabase; render using user's IANA timezone

## Key Modules
- `src/lib/time/` — parseLocalToUTC, convertUTCToLocal, generateOccurrences, getWeekRange
- `src/lib/supabase.ts` — Supabase client
- `src/stores/` — Zustand stores
- `src/locales/` — Translation JSON files (en, sv, de)
- `src/features/` — auth, family, events, weekly-view, notifications, subscription

## Completed Steps
- [x] Project scaffolded with `create-expo-app`
- [x] Dependencies installed
- [x] Folder structure created
- [x] Time utilities implemented
- [x] i18n configured
- [x] Supabase client + DB types defined
- [x] Zustand stores created
- [x] Screens and navigation set up
