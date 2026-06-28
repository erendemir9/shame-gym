# S.H.A.M.E Gym — Organization Management System

**Strength · Health · Athletics · Motivation · Excellence**

A gym organization management web application for members, trainers, class schedules, enrollments, workout programs, staff meetings, and role-based dashboards. The application runs in the browser with a PHP + MySQL backend on XAMPP.

---

## Table of contents

1. [Project overview](#project-overview)
2. [Tech stack](#tech-stack)
3. [System architecture](#system-architecture)
4. [Core feature flow](#core-feature-flow)
5. [Login and API request flow](#login-and-api-request-flow)
6. [User roles and access](#user-roles-and-access)
7. [Data persistence](#data-persistence)
8. [Database setup](#database-setup)
9. [Database schema overview](#database-schema-overview)
10. [Database ER diagram](#database-er-diagram)
11. [Backend API structure](#backend-api-structure)
12. [Running the project locally](#running-the-project-locally)
13. [Demo accounts](#demo-accounts)
14. [Testing checklist](#testing-checklist)
15. [Security notes](#security-notes)
16. [Current scope and future expansion](#current-scope-and-future-expansion)
17. [Project structure](#project-structure)

---

## Project overview

S.H.A.M.E Gym is a software engineering course project that models day-to-day operations for a fitness organization. Staff and members share one MySQL database through JSON API endpoints.

| Area | What the system handles |
|------|-------------------------|
| People | Members, trainers, login accounts |
| Classes | Timetable, capacity, enrollment |
| Training | Workout plans and day progress |
| Operations | Staff meetings and attendees |
| Self-service | Profile edits and account activation |
| Reporting | Role-aware dashboard statistics |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, CSS (custom theme), Vanilla JavaScript |
| Backend | PHP (plain, no framework) |
| Database | MySQL / MariaDB |
| Local server | XAMPP (Apache + MySQL) |
| Database admin | phpMyAdmin |

Pages call JSON endpoints with `fetch()` and `credentials: "same-origin"`. There is no build step or frontend framework.

---

## System architecture

The diagram below shows how the browser, PHP API layer, and database work together. PHP sessions and role checks run on every protected request.

```mermaid
flowchart LR
    User[User Browser] --> Pages[HTML Pages]
    Pages --> JS[Vanilla JavaScript]
    JS -->|fetch JSON| API[PHP API Endpoints]
    API --> Auth[Session and Role Checks]
    Auth --> PDO[PDO Prepared Statements]
    PDO --> DB[(MySQL shame_gym_db)]
    JS -. session cache / fallback only .-> LS[localStorage]
    Auth -. PHP session .-> Session[(Server Session)]
```

| Layer | Responsibility |
|-------|----------------|
| HTML pages | Layout, forms, tables, navigation shell |
| JavaScript | Render UI, call APIs, enforce page-level access |
| PHP APIs | Authenticate, validate input, query database, return JSON |
| MySQL | Persistent storage for all application records |
| localStorage | Session display cache, UI preferences, emergency fallback only |

---

## Core feature flow

Each visible module reads and writes through its API folder. The database tables on the right are the primary storage target.

```mermaid
flowchart TB
    subgraph Frontend["Frontend Pages"]
        AuthP[index.html]
        Dash[dashboard.html]
        Mem[members.html]
        Trn[trainers.html]
        Sch[schedules.html]
        Wkt[workouts.html]
        Mtg[meetings.html]
        Prf[profile.html]
    end

    subgraph API["PHP API"]
        A1[api/auth/]
        A2[api/dashboard/]
        A3[api/members/]
        A4[api/trainers/]
        A5[api/classes/]
        A6[api/enrollments/]
        A7[api/workouts/]
        A8[api/meetings/]
        A9[api/profile/]
        A10[api/users/]
    end

    subgraph DB["MySQL Tables"]
        T1[users]
        T2[members]
        T3[trainers]
        T4[classes]
        T5[enrollments]
        T6[workout_plans]
        T7[workout_progress]
        T8[meetings]
        T9[meeting_attendees]
    end

    AuthP --> A1 --> T1
    Dash --> A2 --> T1
    Dash --> A2 --> T2
    Dash --> A2 --> T4
    Mem --> A3 --> T2
    Trn --> A4 --> T3
    Sch --> A5 --> T4
    Sch --> A6 --> T5
    Wkt --> A7 --> T6
    Wkt --> A7 --> T7
    Mtg --> A8 --> T8
    Mtg --> A8 --> T9
    Prf --> A9 --> T1
    Mem --> A10 --> T1
    Mtg --> A10 --> T1
```

**Module distinction**

| Module | Purpose |
|--------|---------|
| Schedules | Group fitness classes that members enroll in |
| Workouts | Personal training programs with daily progress |
| Meetings | Internal staff coordination (admin only) |

---

## Login and API request flow

```mermaid
sequenceDiagram
    participant U as User
    participant P as HTML / JavaScript
    participant A as PHP API
    participant S as PHP Session
    participant D as MySQL

    U->>P: Open protected page
    P->>A: GET api/auth/session.php
    A->>S: Read session user
    alt Not logged in
        A-->>P: 401 Unauthorized
        P-->>U: Redirect to index.html
    else Logged in
        A-->>P: 200 user JSON
        P->>P: Cache safe user in localStorage
    end

    U->>P: Submit login form
    P->>A: POST api/auth/login.php
    A->>D: SELECT user by email
    A->>A: password_verify(password_hash)
    A->>S: Store session user
    A-->>P: 200 success + user JSON
    P-->>U: Redirect to dashboard

    U->>P: Open dashboard
    P->>A: GET api/dashboard/stats.php
    A->>S: requireLogin + role check
    A->>D: SELECT counts and related rows
    A-->>P: 200 JSON stats
    P-->>U: Render cards and lists

    U->>P: Save record (e.g. create member)
    P->>A: POST api/members/create.php
    A->>S: requireRole(admin)
    A->>D: INSERT with prepared statement
    A-->>P: 200 success JSON
    P->>A: GET api/members/list.php
    A->>D: SELECT updated list
    A-->>P: 200 JSON
    P-->>U: Refresh table from database
```

---

## User roles and access

Page navigation and API endpoints both enforce the same role rules.

| Feature | Admin | Trainer | Member |
|---------|-------|---------|--------|
| Dashboard | Full access | Full access | Full access |
| Members | Full access | View assigned only | No access |
| Trainers | Full access | No access | No access |
| Schedules (classes) | Full access | View own classes | View and enroll |
| Enrollments | Manage rosters | View own rosters | Own enrollments |
| Profile | No access | No access | Own data |
| Workout plans | Full access | Manage assigned | View own |
| Workout progress | Full access | View assigned | Update own |
| Meetings | Full access | No access | No access |
| Account activation | Yes | Yes | Yes |

**Role summaries**

| Role | Typical tasks |
|------|---------------|
| **Admin** | Manage members, trainers, classes, workouts, and staff meetings; view organization stats |
| **Trainer** | View assigned members, create workout plans, view own class rosters |
| **Member** | Enroll in classes, follow workout program, edit own profile |

---

## Data persistence

| Storage | Role |
|---------|------|
| **MySQL (`shame_gym_db`)** | Primary source of truth for all application records |
| **PHP APIs** | Validate sessions, enforce roles, read/write database with PDO |
| **PHP session** | Server-side authentication state |
| **localStorage** | Not the primary database |

localStorage is used only for:

- A non-sensitive session cache mirrored from the server (`shame_session`)
- UI preferences (for example splash screen skip)
- Seed/bootstrap data on first load
- Emergency fallback when the API is unreachable

Normal create, update, delete, and list operations go through PHP and MySQL.

---

## Database setup

### Prerequisites

1. Install [XAMPP](https://www.apachefriends.org/) with Apache and MySQL running.
2. Place the project in your web root:
   ```
   /Applications/XAMPP/xamppfiles/htdocs/shame-gym
   ```

### Create database and load data

**Terminal**

```bash
/Applications/XAMPP/xamppfiles/bin/mysql -uroot < database/schema.sql
/Applications/XAMPP/xamppfiles/bin/mysql -uroot < database/seed.sql
```

**phpMyAdmin**

1. Open http://localhost/phpmyadmin
2. Import `database/schema.sql`
3. Import `database/seed.sql`

This creates **`shame_gym_db`** with foreign keys and demo data. Connection settings are in `api/config/database.php` (default: `localhost`, user `root`, empty password).

---

## Database schema overview

### Authentication and accounts

| Table | Purpose |
|-------|---------|
| `users` | Login accounts with `password_hash`, role, and links to member/trainer profiles |

### Core gym management

| Table | Purpose |
|-------|---------|
| `members` | Member profiles, membership type, assigned trainer |
| `trainers` | Trainer profiles and specialization |
| `classes` | Scheduled group fitness sessions |
| `enrollments` | Member sign-ups for classes |

### Workout management

| Table | Purpose |
|-------|---------|
| `workout_plans` | Trainer-authored programs (`plan_details` JSON) |
| `workout_progress` | Completed workout days per plan |

### Staff meetings

| Table | Purpose |
|-------|---------|
| `meetings` | Staff meeting records |
| `meeting_attendees` | Invited staff (`user_id`, `attendee_email`) |

### Prepared future extensions (no UI yet)

| Table | Purpose |
|-------|---------|
| `documents` | Uploaded document metadata |
| `document_access` | Role-based document visibility |
| `polls` | Organization ballots |
| `poll_options` | Poll answer choices |
| `votes` | Anonymous ballot selections |
| `vote_receipts` | Duplicate-vote prevention |
| `finance_transactions` | Income and expense ledger |
| `whatsapp_imports` | WhatsApp export upload batches |
| `whatsapp_messages` | Parsed chat messages |
| `whatsapp_analysis_summary` | Precomputed chat analytics |
| `import_batches` | Bulk legacy import tracking |
| `import_errors` | Rejected import rows |

---

## Database ER diagram

Core tables used by the visible application. Foreign key column names match `database/schema.sql`.

```mermaid
erDiagram
    users {
        int id PK
        string email
        string role
        int linked_member_id FK
        int linked_trainer_id FK
    }
    members {
        int id PK
        string email
        int assigned_trainer_id FK
    }
    trainers {
        int id PK
        string email
    }
    classes {
        int id PK
        int trainer_id FK
    }
    enrollments {
        int id PK
        int class_id FK
        int member_id FK
    }
    workout_plans {
        int id PK
        int member_id FK
        int trainer_id FK
    }
    workout_progress {
        int id PK
        int workout_plan_id FK
        int member_id FK
    }
    meetings {
        int id PK
        int created_by_user_id FK
    }
    meeting_attendees {
        int id PK
        int meeting_id FK
        int user_id FK
    }

    users ||--o| members : "linked_member_id"
    users ||--o| trainers : "linked_trainer_id"
    trainers ||--o{ members : "assigned_trainer_id"
    trainers ||--o{ classes : "trainer_id"
    members ||--o{ enrollments : "member_id"
    classes ||--o{ enrollments : "class_id"
    members ||--o{ workout_plans : "member_id"
    trainers ||--o{ workout_plans : "trainer_id"
    workout_plans ||--o{ workout_progress : "workout_plan_id"
    members ||--o{ workout_progress : "member_id"
    users ||--o{ meetings : "created_by_user_id"
    meetings ||--o{ meeting_attendees : "meeting_id"
    users ||--o{ meeting_attendees : "user_id"
```

### Prepared extension tables (schema only)

These tables exist in the schema but are not connected to visible pages today.

```mermaid
erDiagram
    users ||--o{ documents : "uploaded_by_user_id"
    documents ||--o{ document_access : "document_id"
    users ||--o{ polls : "created_by_user_id"
    polls ||--o{ poll_options : "poll_id"
    polls ||--o{ votes : "poll_id"
    poll_options ||--o{ votes : "option_id"
    polls ||--o{ vote_receipts : "poll_id"
    users ||--o{ vote_receipts : "user_id"
    users ||--o{ finance_transactions : "created_by_user_id"
    users ||--o{ whatsapp_imports : "uploaded_by_user_id"
    whatsapp_imports ||--o{ whatsapp_messages : "import_id"
    whatsapp_imports ||--|| whatsapp_analysis_summary : "import_id"
    users ||--o{ import_batches : "created_by_user_id"
    import_batches ||--o{ import_errors : "batch_id"
```

---

## Backend API structure

All endpoints return JSON. Protected routes require a valid PHP session cookie.

| API folder | Purpose | Main tables |
|------------|---------|-------------|
| `api/auth/` | Login, logout, session check, account activation | `users` |
| `api/dashboard/` | Role-aware dashboard statistics | `members`, `trainers`, `classes`, `enrollments`, `workout_plans`, `meetings` |
| `api/profile/` | Current user profile read/update | `users`, `members`, `trainers` |
| `api/members/` | Member list, get, create, update, soft delete | `members`, `users` |
| `api/trainers/` | Trainer list, get, create, update, soft delete | `trainers`, `users` |
| `api/classes/` | Class schedule list, get, create, update, cancel | `classes` |
| `api/enrollments/` | Enrollment list, enroll, unenroll | `enrollments` |
| `api/workouts/` | Workout plans, progress, archive | `workout_plans`, `workout_progress` |
| `api/meetings/` | Staff meetings and attendee management | `meetings`, `meeting_attendees` |
| `api/users/` | Staff user list for meeting attendees; account provisioning | `users` |
| `api/config/` | Shared database, auth, request, and response helpers | — |

Shared PHP helpers include `requireLogin()`, `requireRole()`, `successResponse()`, `errorResponse()`, and PDO connection setup.

### Page to API mapping

| Feature | Page | Backend |
|---------|------|---------|
| Login / logout / session | `index.html` | `api/auth/*` |
| Account activation | `index.html` | `api/auth/activate.php` |
| Dashboard stats | `dashboard.html` | `api/dashboard/stats.php` |
| Member CRUD | `members.html` | `api/members/*` |
| Trainer CRUD | `trainers.html` | `api/trainers/*` |
| Class CRUD | `schedules.html` | `api/classes/*` |
| Enrollment | `schedules.html` | `api/enrollments/*` |
| Profile | `profile.html` | `api/profile/me.php` |
| Workouts | `workouts.html` | `api/workouts/*` |
| Meetings | `meetings.html` | `api/meetings/*`, `api/users/list.php` |

---

## Running the project locally

1. Start **Apache** and **MySQL** in the XAMPP control panel.
2. Import the database (see [Database setup](#database-setup)).
3. Open http://localhost/shame-gym/
4. Log in with a [demo account](#demo-accounts).
5. Optional: inspect data at http://localhost/phpmyadmin

Use `http://localhost/shame-gym/` (not `file://`) so PHP sessions and API calls work correctly.

---

## Demo accounts

Passwords match `database/seed.sql`.

### Admin — password: `admin123`

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@shame.gym` | `admin123` |

### Trainers — password: `trainer123`

| Role | Email | Password |
|------|-------|----------|
| Trainer | `trainer@shame.gym` | `trainer123` |
| Trainer | `marcus.hale@shame.gym` | `trainer123` |
| Trainer | `nadia.petrova@shame.gym` | `trainer123` |
| Trainer | `diego.santos@shame.gym` | `trainer123` |
| Trainer | `priya.anand@shame.gym` | `trainer123` |
| Trainer | `tyler.brooks@shame.gym` | `trainer123` |

### Members — password: `member123`

| Role | Email | Password |
|------|-------|----------|
| Member | `member@shame.gym` | `member123` |
| Member | `james.carter@email.com` | `member123` |
| Member | `sofia.romano@email.com` | `member123` |
| Member | `liam.novak@email.com` | `member123` |
| Member | `amara.okafor@email.com` | `member123` |
| Member | `daniel.reyes@email.com` | `member123` |
| Member | `elena.fischer@email.com` | `member123` |

### Pending activation demo

| Email | Notes |
|-------|-------|
| `pending.member@shame.gym` | No password in seed — use **Activate your account** on the login page |

---

## Testing checklist

- [ ] Log in as admin (`admin@shame.gym`)
- [ ] Create a new member and assign a trainer
- [ ] Create a new trainer and confirm they appear in the member trainer dropdown
- [ ] Complete account activation for a pending user
- [ ] Create a class on Schedules
- [ ] Log in as member and enroll in a class
- [ ] Open class roster and confirm enrolled member appears
- [ ] Edit profile as member (name / email / phone)
- [ ] Create a workout plan for a member
- [ ] Mark a workout day complete as that member
- [ ] Schedule a staff meeting with attendees (admin)
- [ ] Refresh each page and confirm data persists from MySQL

---

## Security notes

| Topic | Implementation |
|-------|----------------|
| Role-based access | Checked in JavaScript navigation and enforced again in every PHP API |
| PHP sessions | Authentication stored server-side; APIs are the authority |
| Prepared statements | All database queries use PDO prepared statements |
| Password storage | bcrypt hashes in `users.password_hash`; never returned in JSON |
| Account activation | New accounts can require password setup before login |
| Soft delete | Status fields (`inactive`, `cancelled`, `archived`) used where appropriate |

---

## Current scope and future expansion

The visible application covers authentication, members, trainers, schedules, enrollments, dashboard, profile, workouts, and staff meetings.

The database also includes prepared structures for documents, polls, finance, WhatsApp analytics, and bulk import tracking. These can be connected to additional UI pages in future work without changing the core architecture above.

---

## Project structure

```
shame-gym/
  index.html              Login and account activation
  dashboard.html          Role-aware home page
  members.html            Member management / trainer assigned view
  trainers.html           Trainer management
  schedules.html          Class timetable and enrollment
  workouts.html           Workout plans and member progress
  meetings.html           Staff meetings (admin)
  profile.html            Member profile self-edit

  css/                    Custom stylesheets
  js/                     Page logic and API integration
  api/                    PHP JSON endpoints
  database/
    schema.sql            Full MySQL schema
    seed.sql              Demo data
  assets/                 Logo and static images
```

| JavaScript file | Role |
|-----------------|------|
| `auth.js` | Login, session sync, permissions, sidebar |
| `data.js` | Seed data and emergency fallback helpers |
| `members.js`, `trainers.js`, `schedules.js` | CRUD pages |
| `enrollments.js` | Class enrollment logic |
| `workouts.js`, `meetings.js` | Workouts and meetings |
| `profile.js`, `dashboard.js` | Profile and dashboard |
| `toast.js`, `phone.js` | Notifications and phone input |

---

## License

Academic / demo project — see repository owner for usage terms.
