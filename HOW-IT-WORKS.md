# S.H.A.M.E Gym — How It Works

A plain-English guide to the project. We will use this to explain the code to
the professor. **There is no backend** — everything runs in the browser using
hardcoded data and `localStorage`. Every page works by just opening the `.html`
file (`file://`), no server needed.

---

## 1. File structure

```
shame-gym/
  index.html        Login page + splash intro (the entry point)
  dashboard.html    Dashboard: welcome + quick stats from localStorage
  members.html      Member management (add + edit) / trainer assigned view
  trainers.html     Trainer management (add, shown as cards)
  schedules.html    Class schedule + member enrollment
  workouts.html     Workout plans (trainer manage / member follow)
  meetings.html     Admin staff meeting scheduling
  profile.html      Member self-service profile edit
  css/style.css     ALL styles: theme variables, layout, components, animations
  css/workouts.css  Workout-specific styles
  js/data.js        Seed data + localStorage read/save helpers
  js/auth.js        Users, permissions, session, guards, sidebar
  js/toast.js       One reusable toast notification (showToast)
  js/members.js     Members page logic + trainer assigned view
  js/trainers.js    Trainers page logic
  js/schedules.js   Schedules page logic + enrolled classes on dashboard
  js/workouts.js    Workout plans + member progress tracking
  js/enrollments.js Class enrollment helpers
  js/meetings.js    Staff meeting CRUD (admin)
  js/profile.js     Member profile update
  js/phone.js       Phone field formatting helpers
  assets/logo.jpeg  The S.H.A.M.E logo
```

Internal pages share the same layout: a fixed left sidebar (logo, nav links,
user info + Logout) and a main content area on the right.

---

## 2. User stories implemented

| Story | Who | Where |
|-------|-----|-------|
| Update personal information | Member | `profile.html` |
| Schedule staff meetings | Admin | `meetings.html` |
| Create workout plans | Trainer / Admin | `workouts.html` |
| Enroll in gym classes | Member | `schedules.html` |
| View assigned members + progress | Trainer | `members.html` (filtered) |

Forgot password is **deferred** until a backend/database is added (String 3).

---

## 3. How the fake authentication works (IAP-25)

1. `js/auth.js` stores login accounts in `localStorage` under `shame_users`.
2. **No public sign-up.** Admin adds members/trainers; that creates a pending login.
3. New users activate via **Activate your account** on the login page.
4. On login → `saveSession(user)` → redirect to `dashboard.html`.

Demo accounts: `admin@shame.gym` / `admin123`, `trainer@shame.gym` / `trainer123`,
`member@shame.gym` / `member123`.

---

## 4. Role-based access control

Driven by **one central permissions map** in `js/auth.js`.

### Permission matrix (summary)

| Capability | Admin | Trainer | Member |
|------------|:-----:|:-------:|:------:|
| Members (manage) | ✅ | ❌ | ❌ |
| Members (view assigned) | ✅ all | ✅ assigned only | ❌ |
| Trainers | ✅ | ❌ | ❌ |
| Schedules (create) | ✅ | ❌ | ❌ |
| Schedules (view + enroll) | ✅ | ✅ view | ✅ enroll |
| Workouts (manage plans) | ✅ | ✅ | ❌ |
| Workouts (follow plan) | — | — | ✅ |
| Staff meetings | ✅ | ❌ | ❌ |
| My Profile | — | — | ✅ |

Trainers **cannot** see the Trainers page. Members **cannot** open admin pages;
`requirePageAccess()` redirects to the dashboard with a toast.

---

## 5. localStorage keys

| Key | Purpose |
|-----|---------|
| `shame_users` | Login accounts |
| `shame_session` | Current session (no password) |
| `shame_members` | Member records (+ `assignedTrainerEmail`) |
| `shame_trainers` | Trainer records |
| `shame_schedules` | Class timetable |
| `shame_enrollments` | Member class sign-ups |
| `shame_workout_plans` | Workout programs per member |
| `shame_workout_progress` | Day completion per plan |
| `shame_meetings` | Admin staff meetings |

Every form follows: **validate → save → re-render → toast.**

---

## 6. Feature notes

### Member profile (`profile.html`)
Member edits name, email, phone. Updates both `shame_users` and the linked
`shame_members` row. Membership type and start date are read-only.

### Staff meetings (`meetings.html`)
Admin creates meetings with title, date, time, location, notes, and staff
attendees (trainers/admins). Dashboard shows the next 3 upcoming meetings.

### Class enrollment (`schedules.html`)
Members see **Spots** (enrolled / capacity) and **Enroll / Unenroll** buttons.
Full classes show a "Full" badge. Enrolled classes appear on the member dashboard.

### Workout plans (`workouts.html`)
Trainers assign plans to members (days + exercises). Members mark days complete;
progress is stored in `shame_workout_progress`.

### Assigned members (trainer view on `members.html`)
Admin sets **Assigned trainer** when adding/editing a member. Trainers only see
members where `assignedTrainerEmail` matches their login, plus workout plan name
and completion progress.

---

## 7. Reset the demo

DevTools → Application → Local Storage → delete `shame_*` keys (or
`localStorage.clear()`), then refresh. Seed data is recreated on first load.

---

## 8. Things to know for the professor's questions

- **Why no framework?** Pure HTML/CSS/vanilla JS — opens from the file system.
- **Why `var` and plain functions?** Kept simple and explainable per sprint brief.
- **Why `textContent`?** Prevents HTML injection when rendering user data.
- **Why remove buttons instead of hide?** Restricted controls are not rendered at all.
