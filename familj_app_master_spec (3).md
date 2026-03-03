# FAMILJ – Product & Technical Specification

## 1. Vision
Build the most minimalist, Scandinavian family planning app focused on weekly structure.

The app should reduce mental load in everyday life through:
- An extremely simple weekly view
- Fast event creation
- Recurring activities
- Clear structure for children’s homework and tests

Design principle: IKEA – functional, calm, clear.

The app must be international-ready from day one.

---

# 2. Positioning

## Core Promise
"Full control of your week. Without stress."

## Target Audience
- Families with children (ages 3–12)
- Shared custody households
- Two working parents

## Differentiation
- Weekly view first (not daily view)
- Minimal UI
- Smart but invisible AI
- International support from day one (language + timezone aware)

---

# 3. Functional MVP (v1 – App Store Ready)

## 3.1 Onboarding
- Create account (email + magic link / Apple Sign In)
- Create family
- Add members (name + color)
- Auto-detect device language + timezone
- Allow manual override
- Done

## 3.2 Weekly View (Home Screen)
- Default: current week
- Swipe between weeks
- Color-coded events
- Subtle conflict indicator
- Floating Action Button (➕)
- Week start based on locale (Monday/Sunday)

## 3.3 Create Event
Fields:
- Who is this for? (multi-select allowed)
- Title
- Date + time (localized format)
- Type (Activity / Homework / Test / Other)
- Reminder
- Repeat (optional)

Creation time target: <10 seconds.

Supports:
- One-time events
- Recurring events

## 3.4 Recurring Events
Supported in v1:
- Weekly
- Biweekly
- Weekdays

Edit options:
- This event only
- This and future events
- All events

Recurring logic must be timezone-safe and DST-safe.

## 3.5 Push Notifications
- One day before
- One hour before
- Delivered in user's timezone

## 3.6 Sunday Summary (Premium)
Automatic weekly summary:
- Number of activities
- Number of tests
- Conflicts detected

Localized per language.

---

# 4. Monetization (Implemented From Day One)

## Model: Freemium + Subscription

### Free Tier
- 1 family
- Maximum 3 members
- Core features
- Standard reminders

### Premium (localized pricing via App Store)
- Unlimited members
- AI natural language parsing
- Sunday summary
- Widget
- Advanced recurring rules
- PDF export

## Technical Requirements
- Apple In-App Subscriptions
- Monthly + Yearly plans
- Server-side receipt validation
- Feature gating via subscription_status
- Localized subscription descriptions

---

# 5. Internationalization (Mandatory From Start)

## 5.1 Language System (i18n)

Requirements:
- Default to device language
- User can override language manually
- Language stored per user
- All UI strings externalized
- No hardcoded strings in components

Implementation:
- i18next + react-i18next
- JSON translation files

Example structure:

/locales
  /en
  /sv
  /de

Initial launch languages:
- English
- Swedish
- German

---

## 5.2 Time Zone Handling

Golden Rule:
All dates and times are stored in UTC in the database.

Events table must store:
- start_time_utc
- end_time_utc
- timezone (IANA format, e.g., Europe/Stockholm)

When creating event:
- Convert local time → UTC before saving

When rendering:
- Convert UTC → user timezone

Library recommendation:
- date-fns-tz or luxon

Recurring events must generate instances based on original timezone to avoid DST drift.

---

## 5.3 Locale & Regional Preferences

Language ≠ Locale.

System must support:
- Week start (Monday/Sunday)
- 12h / 24h clock
- Local date formatting
- Week numbers (ISO support)

User preferences stored per profile.

---

# 6. UX Design Principles

## Visual Design
- Off-white background
- Soft muted pastel colors
- System font
- Maximum 3 typography levels
- No visual overload

## Interaction Design
- Maximum 2 taps for core flow
- Bottom sheet for creation
- No complex nested menus
- Calm and predictable animations

---

# 7. Technical Architecture

## Frontend
- Expo + React Native
- TypeScript only
- Feature-based folder structure
- Clean service layer
- Centralized date/time utility module
- Zustand (or similar) for state management

## Backend
- Supabase
- Row Level Security (RLS)
- Edge Functions for AI and recurrence expansion
- EU region hosting (GDPR compliance)

---

# 8. Core Database Model

## profiles
- id
- language
- timezone (IANA string)
- locale
- week_start_preference
- time_format_preference
- created_at

## families
- id
- name
- owner_id
- created_at

## members
- id
- family_id
- name
- color
- role (parent/child)

## events
- id
- family_id
- title
- start_time_utc
- end_time_utc
- timezone
- type
- recurrence_rule (nullable)
- created_by
- created_at

## subscriptions
- user_id
- status
- plan
- expires_at
- platform (ios)

---

# 9. Recurring Logic Engine

Use master event + recurrence_rule.

No duplicated rows for each occurrence.

When loading a week:
1. Fetch one-time events within range
2. Fetch recurring masters
3. Generate occurrences in memory based on timezone
4. Merge + sort

Must support:
- DST changes
- User timezone change
- Traveling users

---

# 10. AI (Premium Feature)

Natural language input example:
"Football Tuesday 17-18"

System parses:
- Day
- Time
- Member (if inferred)

Parsing must respect user locale and time format.

Server-side LLM implementation for provider flexibility.

---

# 11. Widgets (Premium)

- iOS Home Screen widget
- Shows today + tomorrow
- Respects language + timezone
- Background refresh support

---

# 12. Security & Compliance

- RLS enforced per family_id
- HTTPS only
- GDPR compliant storage (EU)
- Minimal data collection
- No public sharing without explicit invitation

---

# 13. App Store Preparation

- Privacy Policy
- Terms of Service
- Subscription disclosure compliance
- Localized screenshots
- App Store Optimization (ASO) per region

---

# 14. Roadmap (Post-MVP)

v1.1
- Shared custody mode
- Advanced conflict detection

v1.2
- School calendar import
- Responsibility assignment

v2
- AI weekly planner
- External calendar integrations
- Android release

---

# 15. Build Order

1. Database schema + RLS
2. Profiles (language + timezone handling)
3. Authentication + family creation
4. Weekly view rendering
5. Event creation flow
6. Recurring logic engine
7. Timezone-safe rendering
8. Push notifications
9. Subscription system
10. Premium feature gating
11. UI polish + performance optimization
12. App Store submission

---

# 16. Definition of Done (v1)

- User can create account
- User can create family
- Members can be added
- One-time events work
- Recurring events function correctly
- Timezone conversions are correct
- Language switching works
- Premium subscription can be purchased and validated
- Push notifications trigger correctly
- App approved in the App Store

---

# 17. Architectural Priority (Critical Foundation)

Before expanding UI, subscriptions, or growth features, the following must be fully defined and implemented correctly.

## 17.1 Time Engine First

Calendar trust depends entirely on correct time handling.

This must be treated as infrastructure-level code.

All time logic must live in a centralized module:

/lib/time/
  - parseLocalToUTC()
  - convertUTCToLocal()
  - generateOccurrences()
  - getWeekRange()

No UI component is allowed to manipulate raw Date objects directly.
All conversions must go through the time utility layer.

Golden rules:
- All timestamps stored in UTC
- All rendering converted to user timezone
- Recurring generation based on original timezone
- DST-safe calculations mandatory

---

## 17.2 Recurrence Rule Schema (Structured & Future-Proof)

Recurring events must not rely on simple string flags like "weekly".

Instead, recurrence_rule must be structured JSON.

Example schema:

{
  "frequency": "weekly",
  "interval": 1,
  "byWeekday": ["TU"],
  "timezone": "Europe/Stockholm"
}

Supported in v1:
- Weekly (interval = 1)
- Biweekly (interval = 2)
- Weekdays (MO–FR rule)

This structure allows future support for:
- Monthly rules
- Custom weekday combinations
- Advanced recurrence

Without refactoring the database.

---

## 17.3 Week Rendering Algorithm

When loading a week:

1. Fetch one-time events within range
2. Fetch recurring master events
3. Generate occurrences in memory using:
   - Stored timezone
   - DST-aware calculations
4. Merge and sort

No duplication of recurring rows in database.

---

## 17.4 Why This Comes First

UI can change.
Pricing can change.
Branding can change.

Time architecture cannot be easily refactored once users depend on it.

Calendar bugs break trust immediately.

This layer must be treated with financial-system discipline.

---

Guiding rule for all future development:
Less complexity. More clarity.
International-ready. From day one.
Time-safe. From the foundation.

