# S.H.A.M.E Gym

**Strength · Health · Athletics · Motivation · Excellence**

A browser-only gym management demo built with plain HTML, CSS, and vanilla JavaScript. There is **no backend**, **no build step**, and **no framework** — open `index.html` directly in a browser (`file://`) and everything runs from `localStorage`.

Use this README as the single source of truth for how the project works, who can do what, and how to demo it.

---

## Table of contents

1. [Quick start](#quick-start)
2. [Demo credentials](#demo-credentials)
3. [What each major feature does](#what-each-major-feature-does)
4. [User stories implemented](#user-stories-implemented)
5. [Project structure](#project-structure)
6. [Authentication & roles](#authentication--roles)
7. [localStorage data model](#localstorage-data-model)
8. [How pages work together](#how-pages-work-together)
9. [Resetting the demo](#resetting-the-demo)
10. [Design & code conventions](#design--code-conventions)
11. [Deferred / future work](#deferred--future-work)

---

## Quick start

1. Clone or download this repository.
2. Open **`index.html`** in a modern browser (Chrome, Firefox, Safari, Edge).
3. Log in with any [demo account](#demo-credentials) below.
4. Explore the sidebar — nav links change based on your role.

**First-time login flow:** Admin-created members/trainers get a pending account. They use **Activate your account** on the login page to set a password, then log in normally.

---

## Demo credentials

All seed accounts are pre-activated (no activation needed for demo logins).

### Admin — password: `admin123`

| Email |
|-------|
| `admin@shame.gym` |

### Trainers — password: `trainer123`

| Email | Name (in app) |
|-------|----------------|
| `trainer@shame.gym` | Trainer User |
| `marcus.hale@shame.gym` | Marcus Hale |
| `nadia.petrova@shame.gym` | Nadia Petrova |
| `diego.santos@shame.gym` | Diego Santos |
| `priya.anand@shame.gym` | Priya Anand |
| `tyler.brooks@shame.gym` | Tyler Brooks |

### Members — password: `member123`

| Email | Name (in app) |
|-------|----------------|
| `member@shame.gym` | Member User |
| `james.carter@email.com` | James Carter |
| `sofia.romano@email.com` | Sofia Romano |
| `liam.novak@email.com` | Liam Novak |
| `amara.okafor@email.com` | Amara Okafor |
| `daniel.reyes@email.com` | Daniel Reyes |
| `elena.fischer@email.com` | Elena Fischer |

The same list appears on the login page under **Demo credentials**.

---

## What each major feature does

Three similar-sounding areas serve different purposes:

| Feature | Page | Who | What it is | What users do |
|---------|------|-----|------------|---------------|
| **Schedules** | `schedules.html` | Everyone (members enroll) | **Group class timetable** — Spinning, Yoga, HIIT, etc. | Admin creates classes. Members **Enroll / Unenroll**. Capacity shown as spots (e.g. `12 / 20`). |
| **Meetings** | `meetings.html` | Admin only | **Internal staff meetings** — ops coordination, not gym classes | Admin schedules meetings with date, location, notes, and staff attendees. |
| **Workouts** | `workouts.html` | Trainer / Admin + Members | **Personal training program** — exercises per day | Trainer assigns a plan to a member. Member follows it and marks days **complete**. |

**In one line:**

- **Schedules** = group classes members sign up for  
- **Meetings** = admin-only staff calendar  
- **Workouts** = one-to-one training plan with progress tracking  

---

## User stories implemented

| Story | Role | Where |
|-------|------|-------|
| Update personal information | Member | `profile.html` |
| Schedule staff meetings | Admin | `meetings.html` |
| Create workout plans for members | Trainer / Admin | `workouts.html` |
| Enroll in gym classes | Member | `schedules.html` |
| View assigned members and their progress | Trainer | `members.html` (filtered view) |
| Manage members, trainers, and classes | Admin | `members.html`, `trainers.html`, `schedules.html` |

---

## Project structure

```
shame-gym/
  index.html          Entry point: splash + login + account activation
  dashboard.html      Role-aware home (stats, enrolled classes, workouts preview)
  members.html        Member list (admin CRUD / trainer assigned view)
  trainers.html       Trainer cards (admin add)
  schedules.html      Class timetable + member enrollment
  workouts.html       Workout plan management or member program view
  meetings.html       Staff meeting scheduling (admin)
  profile.html        Member self-service profile edit

  css/
    style.css         Theme, layout, components, animations, workouts

  js/
    auth.js           Users, permissions, session, guards, sidebar
    data.js           Seed data, localStorage helpers, migration
    toast.js          showToast() notifications
    members.js        Members page
    trainers.js       Trainers page
    schedules.js      Schedules + dashboard enrolled list
    enrollments.js    Class enrollment logic
    workouts.js       Workout plans + progress
    meetings.js       Staff meetings CRUD
    profile.js        Member profile update
    phone.js          International phone country picker (~40 countries)

  assets/
    logo.jpeg         S.H.A.M.E logo
```

Every internal page shares the same shell: **fixed sidebar** (logo, role-based nav, user pill, Logout) + **main content** on the right.

---

## Authentication & roles

### How login works

1. Accounts live in `localStorage` under `shame_users` (seeded on first load).
2. There is **no public sign-up**. An admin adds members/trainers; that creates a login with `needsPasswordSetup: true`.
3. New users **Activate your account** on the login page (email + password).
4. On login, `findUser(email, password)` validates credentials → `saveSession(user)` → redirect to `dashboard.html`.
5. The session stores `{ email, name, role, loggedInAt }` — **never the password**.

### Route protection

- **`requireAuth()`** — every protected page calls this in `<head>`. No session → redirect to `index.html`.
- **`requirePageAccess(pageKey)`** — if the role’s nav does not include that page, redirect to dashboard with an access-denied toast.
- **`logout()`** — clears session and returns to login.

### Permission matrix

| Capability | Admin | Trainer | Member |
|------------|:-----:|:-------:|:------:|
| Dashboard | Yes | Yes | Yes |
| Members (manage add/edit) | Yes | No | No |
| Members (view assigned + progress) | All | Assigned only | No |
| Trainers page | Yes | **No** | No |
| Schedules (create classes) | Yes | No | No |
| Schedules (view + enroll) | View | View | Enroll |
| Workouts (create/edit plans) | Yes | Yes | No |
| Workouts (follow own plan) | — | — | Yes |
| Staff meetings | Yes | No | No |
| My Profile | — | — | Yes |

Permissions are defined once in `js/auth.js` (`PERMISSIONS` map). Pages ask helpers like `canManageMembers()` instead of hard-coding roles.

**UI enforcement:** Restricted nav links are not rendered. Add/Edit buttons are removed (not just hidden) for read-only roles.

### Demo data migration

If you already used the app before new seed accounts were added:

- **`mergeMissingSeedUsers()`** (in `auth.js`) adds any missing demo login accounts without wiping existing data.
- **`migrateSeedData()`** (in `data.js`) merges missing member/trainer records and backfills fields like `assignedTrainerEmail`.

You usually do **not** need to clear localStorage after updates; refresh is enough.

---

## localStorage data model

| Key | Purpose |
|-----|---------|
| `shame_users` | Login accounts (email, password, role, name, linkedId) |
| `shame_session` | Current logged-in user (no password) |
| `shame_members` | Member records (name, email, phone, type, startDate, **assignedTrainerEmail**) |
| `shame_trainers` | Trainer records |
| `shame_schedules` | Group class sessions (name, trainer, date, time, capacity) |
| `shame_enrollments` | Member sign-ups `{ classId, memberEmail, enrolledAt }` |
| `shame_workout_plans` | Workout programs assigned to members |
| `shame_workout_progress` | Per-plan completed day indices |
| `shame_meetings` | Admin staff meetings |

**CRUD pattern (every form):** validate → save to localStorage → re-render → `showToast()`.

Member login accounts link to member rows via **`linkedId`** (e.g. `m1`) or matching email.

---

## How pages work together

### Dashboard (`dashboard.html`)

- **Admin / Trainer:** Animated stat cards (members, trainers, classes) + quick links. Admin also sees upcoming staff meetings.
- **Member:** Membership badges (from real data), enrolled classes list, workout program preview + link to full workouts page, link to profile.

### Members (`members.html`)

- **Admin:** Full table, add/edit modal, assign trainer dropdown, account status badge.
- **Trainer:** Only members where `assignedTrainerEmail` matches their login; columns show workout plan name and completion progress.

### Schedules (`schedules.html`)

- **Admin:** Create class modal (trainer picked from stored trainers).
- **Member:** Enroll / Unenroll with capacity checks; “Full” when no spots left.

### Workouts (`workouts.html`)

- **Trainer / Admin:** Table of plans, create/edit modal (member, days, exercises with sets × reps).
- **Member:** Own plan, trainer notes, progress bar, mark days complete.

### Profile (`profile.html`)

- Member edits **name, email, phone** (40-country phone picker).
- Updates both `shame_users` and linked `shame_members` row.
- Membership type and start date are read-only (admin-managed).

### Meetings (`meetings.html`)

- Admin-only. Create/edit/delete internal meetings with multi-select staff attendees.

---

## Resetting the demo

To start completely fresh:

1. Open DevTools → **Application** → **Local Storage**.
2. Delete all `shame_*` keys — or run `localStorage.clear()` in the console.
3. Refresh the page.

Seed data and demo accounts are recreated automatically on next load.

---

## Design & code conventions

- **No framework** — deliberate choice for a simple, explainable university sprint demo.
- **`var` + plain functions** — no modules, no classes; each page file is self-contained where practical.
- **`textContent` over `innerHTML`** when rendering user data — reduces injection risk.
- **Remove, don’t hide** — restricted controls are not added to the DOM for unauthorized roles.
- **Splash screen** — plays once per browser session on login (`sessionStorage`); skipped after logout flag clear.
- **Styles** — single stylesheet in `css/style.css` (theme, layout, components, workouts).

---

## Deferred / future work

| Feature | Status |
|---------|--------|
| Forgot password | Planned for String 3 when a real backend/database is added |
| Email sending | Not applicable in current localStorage-only demo |
| Delete records (members/classes) | Partial — meetings and workout plans support delete; broader delete is a future sprint |

---

## Suggested demo script (for presentation)

1. **Admin** (`admin@shame.gym` / `admin123`) — show stats, create a class, schedule a staff meeting, assign a trainer to a member.
2. **Trainer** (`marcus.hale@shame.gym` / `trainer123`) — open Members (James Carter assigned), create a workout plan on Workouts.
3. **Member** (`james.carter@email.com` / `member123`) — enroll in a class on Schedules, follow workout on dashboard/Workouts, edit phone on Profile.

---

## License

Academic / demo project — see repository owner for usage terms.
