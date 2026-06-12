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
  members.html      Member management (add + edit)
  trainers.html     Trainer management (add, shown as cards)
  schedules.html    Class schedule management (create classes)
  css/style.css     ALL styles: theme variables, layout, components, animations
  js/data.js        Seed data + localStorage read/save helpers
  js/auth.js        Hardcoded users, login check, session, logout, route guard
  js/toast.js       One reusable toast notification (showToast)
  js/members.js     Members page logic
  js/trainers.js    Trainers page logic
  js/schedules.js   Schedules page logic
  assets/logo.jpeg  The S.H.A.M.E logo
```

The five HTML pages all share the **same** `css/style.css` and the shared JS
files. Internal pages (dashboard, members, trainers, schedules) share the same
layout: a fixed left sidebar (logo, nav links, user info + Logout) and a main
content area on the right.

---

## 2. How the fake authentication works (IAP-25)

There is no server, so we check the password directly in JavaScript.

1. `js/auth.js` holds a `USERS` array with three hardcoded accounts
   (admin / trainer / member), each with an email, password, role and name.
2. On `index.html`, when the login form is submitted:
   - `validateLoginForm()` checks both fields are filled (inline errors if not).
   - `findUser(email, password)` loops through `USERS` and returns the matching
     user, or `null`.
   - If `null` → show the "Invalid email or password" banner.
   - If found → `saveSession(user)` writes a session object to `localStorage`
     under the key `shame_session`:
     `{ email, name, role, loggedInAt }` (we never store the password), then
     redirect to `dashboard.html`.

The session role is saved so future sprints can add role-based restrictions.

---

## 3. How localStorage CRUD works (IAP-38, 39, 40, 43)

`localStorage` is browser storage that survives page refresh. We keep three
lists, each under its own key, as JSON text:

- `shame_members`
- `shame_trainers`
- `shame_schedules`

`js/data.js` does two jobs:

1. **Seeding** — `seedDataIfEmpty()` runs when the file loads. If a key does not
   exist yet, it fills it with realistic sample data. If the key already exists,
   it leaves the user's saved data alone. This is why the tables are never empty
   on first load, but your added records still survive a refresh.
2. **Read / save helpers** — every page uses the same pattern:

```js
var list = getMembers();   // 1. READ the array from localStorage
list.push(newMember);      // 2. CHANGE it (add or edit in place)
saveMembers(list);         // 3. SAVE it back as JSON (survives refresh)
renderMembers();           // 4. RE-DRAW the table from the saved array
```

**Create / Read / Update** are all implemented (delete is a future sprint):
- Create = `push` a new object with a fresh `generateId()`, then save.
- Read = `getMembers()` / `getTrainers()` / `getSchedules()` return the array;
  the `render…()` functions draw it.
- Update (members only, IAP-39) = find the item by `id`, overwrite its fields,
  then save.

Every form follows the identical flow: **validate → save → re-render → toast.**
So once you understand the members page, every other page works the same way.

One nice detail (IAP-43): the "Create class" trainer dropdown is filled by
`populateTrainerSelect()` from the trainers in `localStorage`, so it always
matches the current trainer list.

---

## 4. How the route guard works (IAP-37)

We must stop people from opening a protected page after logging out (including
with the browser Back button).

- Each internal page loads `js/auth.js` in the `<head>` and immediately calls
  `requireAuth()` **before the page body renders**.
- `requireAuth()` calls `getSession()`. If there is no session, it runs
  `window.location.replace("index.html")` — sending the user to the login page.
- **Logout**: the Logout button (wired by `mountSidebarUser()`) calls
  `logout()`, which runs `clearSession()` (removes `shame_session`) and
  redirects to `index.html`.
- Because we use `location.replace`, the protected page is not kept in history,
  so pressing Back also hits a page whose `requireAuth()` finds no session and
  bounces back to login.

---

## 5. The splash intro (visual)

On `index.html`, a full-screen overlay shows the logo scaling in and a
letter-spaced tagline, for about 2.5 seconds, then fades out to reveal the login
card. The animations are **pure CSS**; a tiny JavaScript `setTimeout` triggers
the fade-out, and clicking the overlay skips it. We store a flag in
`sessionStorage` (`shame_splash_played`) so the splash plays **once per browser
session**, not every time you return to the login page.

---

## 6. What each file does (quick table)

| File              | Responsibility                                                        |
|-------------------|-----------------------------------------------------------------------|
| `index.html`      | Splash intro + login form + login validation/auth logic               |
| `dashboard.html`  | Sidebar layout + welcome + quick stats counted from localStorage      |
| `members.html`    | Members table + add/edit modal markup                                 |
| `trainers.html`   | Trainers card grid + add modal markup                                 |
| `schedules.html`  | Schedules table + create-class modal markup                           |
| `css/style.css`   | Theme variables, layout, components, all animations, reduced-motion   |
| `js/data.js`      | Seed data + `get…`/`save…` localStorage helpers + `generateId()`      |
| `js/auth.js`      | `USERS`, `findUser`, session helpers, `requireAuth`, `logout`         |
| `js/toast.js`     | `showToast(message, type)` reused by every page                       |
| `js/members.js`   | Render table, validate, add + edit member                             |
| `js/trainers.js`  | Render cards, validate, add trainer                                   |
| `js/schedules.js` | Render table, fill trainer dropdown, validate, create class           |

---

## 7. Things to know for the professor's questions

- **Why no framework?** The brief requires pure HTML/CSS/vanilla JS so every
  page opens directly from the file system with no build step.
- **Why `var` and plain functions (not classes/modules)?** Kept deliberately
  simple and explainable — small single-purpose functions, no `import`/`export`,
  no design patterns.
- **Where is data stored?** In the browser's `localStorage` (per browser, per
  origin). Clearing browser data resets it; the seed data then comes back.
- **Why `textContent` instead of `innerHTML` when drawing rows?** It puts user
  input in as plain text, so typed characters can't be treated as HTML.
- **Repeated form helpers** (`showFieldError`, `clearFieldError`) appear in each
  page's JS on purpose, so each page file is self-contained and identical to
  read — understand one, understand all.
- **Reset the demo:** open DevTools → Application → Local Storage → delete the
  `shame_*` keys (or run `localStorage.clear()`), then refresh.
