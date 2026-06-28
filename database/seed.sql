-- ============================================================
-- SHAME Gym — Sprint 3 Seed Data
-- Run AFTER database/schema.sql
-- Database: shame_gym_db
-- ============================================================

USE shame_gym_db;

-- ------------------------------------------------------------
-- DEMO LOGIN CREDENTIALS (bcrypt hashes below)
-- ------------------------------------------------------------
-- admin@shame.gym          password: admin123
-- trainer@shame.gym        password: trainer123
-- marcus.hale@shame.gym    password: trainer123
-- nadia.petrova@shame.gym  password: trainer123
-- diego.santos@shame.gym   password: trainer123
-- priya.anand@shame.gym    password: trainer123
-- tyler.brooks@shame.gym   password: trainer123
-- member@shame.gym         password: member123
-- james.carter@email.com   password: member123
-- (all other member demo accounts use member123)
--
-- Pending activation demo (no password yet):
-- pending.member@shame.gym — must complete first-time password setup
-- ------------------------------------------------------------

-- bcrypt placeholders generated with PHP password_hash(PASSWORD_BCRYPT)
SET @hash_admin   = '$2y$10$wGIRb2jFKJgePXMWr8XWje69OU4FRjvDHUu8I6.k/mA5GDiEc19WK'; -- admin123
SET @hash_trainer = '$2y$10$D4lTH/DH4dRHgHqN3V9GpeOJtCu1QaRHGRnVjPcTEjF7MyvVTGkYy'; -- trainer123
SET @hash_member  = '$2y$10$QD3n5gH8PmT9l15Q/vHxZu0eFlE.ke19vAw7b2rBDYSsOUP/f.2bS'; -- member123

-- ------------------------------------------------------------
-- Trainers (matches js/data.js SEED_TRAINERS)
-- ------------------------------------------------------------
INSERT INTO trainers (id, full_name, email, phone, specialization, availability, status) VALUES
(1, 'Marcus Hale',   'marcus.hale@shame.gym',   '+1 202 555 0211', 'Strength', 'Full-time', 'active'),
(2, 'Nadia Petrova', 'nadia.petrova@shame.gym', '+1 202 555 0234', 'Cardio',   'Morning',   'active'),
(3, 'Diego Santos',  'diego.santos@shame.gym',  '+1 202 555 0256', 'CrossFit', 'Evening',   'active'),
(4, 'Priya Anand',   'priya.anand@shame.gym',   '+1 202 555 0278', 'Yoga',     'Weekend',   'active'),
(5, 'Tyler Brooks',  'tyler.brooks@shame.gym',  '+1 202 555 0290', 'Boxing',   'Full-time', 'active');

-- ------------------------------------------------------------
-- Members (matches js/data.js SEED_MEMBERS)
-- ------------------------------------------------------------
INSERT INTO members (id, full_name, email, phone, membership_type, start_date, assigned_trainer_id, status) VALUES
(1, 'James Carter',  'james.carter@email.com',  '+1 202 555 0143', 'Premium', '2025-09-12', 1, 'active'),
(2, 'Sofia Romano',  'sofia.romano@email.com',  '+1 202 555 0188', 'VIP',     '2025-10-01', 2, 'active'),
(3, 'Liam Novak',    'liam.novak@email.com',    '+1 202 555 0117', 'Basic',   '2026-01-05', NULL, 'active'),
(4, 'Amara Okafor',  'amara.okafor@email.com',  '+1 202 555 0162', 'Premium', '2025-11-23', 3, 'active'),
(5, 'Daniel Reyes',  'daniel.reyes@email.com',  '+1 202 555 0109', 'Basic',   '2026-02-14', NULL, 'active'),
(6, 'Elena Fischer', 'elena.fischer@email.com', '+1 202 555 0175', 'VIP',     '2026-03-02', 4, 'active'),
(7, 'Member User',   'member@shame.gym',        '+1 202 555 0100', 'Premium', '2025-08-01', 1, 'active');

-- ------------------------------------------------------------
-- Users (matches js/auth.js SEED_USERS + one pending account)
-- ------------------------------------------------------------
INSERT INTO users (id, email, password_hash, full_name, role, linked_member_id, linked_trainer_id, needs_password_setup, is_active) VALUES
(1,  'admin@shame.gym',         @hash_admin,   'Admin User',    'admin',   NULL, NULL, 0, 1),
(2,  'trainer@shame.gym',       @hash_trainer, 'Trainer User',  'trainer', NULL, NULL, 0, 1),
(3,  'marcus.hale@shame.gym',   @hash_trainer, 'Marcus Hale',   'trainer', NULL, 1,    0, 1),
(4,  'nadia.petrova@shame.gym', @hash_trainer, 'Nadia Petrova', 'trainer', NULL, 2,    0, 1),
(5,  'diego.santos@shame.gym',  @hash_trainer, 'Diego Santos',  'trainer', NULL, 3,    0, 1),
(6,  'priya.anand@shame.gym',   @hash_trainer, 'Priya Anand',   'trainer', NULL, 4,    0, 1),
(7,  'tyler.brooks@shame.gym',  @hash_trainer, 'Tyler Brooks',  'trainer', NULL, 5,    0, 1),
(8,  'member@shame.gym',        @hash_member,  'Member User',   'member',  7,    NULL, 0, 1),
(9,  'james.carter@email.com',  @hash_member,  'James Carter',  'member',  1,    NULL, 0, 1),
(10, 'sofia.romano@email.com',  @hash_member,  'Sofia Romano',  'member',  2,    NULL, 0, 1),
(11, 'liam.novak@email.com',    @hash_member,  'Liam Novak',    'member',  3,    NULL, 0, 1),
(12, 'amara.okafor@email.com',  @hash_member,  'Amara Okafor',  'member',  4,    NULL, 0, 1),
(13, 'daniel.reyes@email.com',  @hash_member,  'Daniel Reyes',  'member',  5,    NULL, 0, 1),
(14, 'elena.fischer@email.com', @hash_member,  'Elena Fischer', 'member',  6,    NULL, 0, 1),
(15, 'pending.member@shame.gym', NULL,         'Pending Member','member',  NULL, NULL, 1, 1);

-- ------------------------------------------------------------
-- Classes (matches js/data.js SEED_SCHEDULES; trainer_id replaces trainerName)
-- ------------------------------------------------------------
INSERT INTO classes (id, class_name, trainer_id, class_date, class_time, duration_minutes, capacity, status) VALUES
(1, 'Spinning Burn',  2, '2026-06-15', '07:00:00', 45, 20, 'scheduled'),
(2, 'HIIT Inferno',   3, '2026-06-15', '18:30:00', 30, 16, 'scheduled'),
(3, 'Yoga Flow',      4, '2026-06-16', '09:00:00', 60, 25, 'scheduled'),
(4, 'Boxing Basics',  5, '2026-06-16', '19:00:00', 50, 12, 'scheduled'),
(5, 'Power Strength', 1, '2026-06-17', '17:00:00', 60, 14, 'scheduled'),
(6, 'Morning Cardio', 2, '2026-06-18', '06:30:00', 40, 18, 'scheduled');

-- ------------------------------------------------------------
-- Enrollments (sample registrations)
-- ------------------------------------------------------------
INSERT INTO enrollments (class_id, member_id, enrolled_at, status) VALUES
(1, 7, '2026-06-10 08:00:00', 'enrolled'),
(1, 1, '2026-06-10 09:15:00', 'enrolled'),
(2, 4, '2026-06-11 10:30:00', 'enrolled'),
(3, 6, '2026-06-11 11:00:00', 'enrolled'),
(5, 7, '2026-06-12 14:00:00', 'enrolled'),
(6, 2, '2026-06-12 16:45:00', 'enrolled');

-- ------------------------------------------------------------
-- Workout plan (matches js/workouts.js SEED_WORKOUT_PLANS structure)
-- ------------------------------------------------------------
INSERT INTO workout_plans (id, member_id, trainer_id, plan_name, notes, plan_details, status) VALUES
(
  1,
  7,
  1,
  '12-Week Strength Builder',
  'Focus on controlled form over heavy weight. Rest 90 seconds between sets and log how each session feels — we will adjust next week.',
  JSON_OBJECT(
    'days', JSON_ARRAY(
      JSON_OBJECT(
        'day', 'Monday',
        'focus', 'Lower Body',
        'exercises', JSON_ARRAY(
          JSON_OBJECT('name', 'Back Squats', 'sets', 4, 'reps', 10),
          JSON_OBJECT('name', 'Romanian Deadlift', 'sets', 3, 'reps', 12),
          JSON_OBJECT('name', 'Walking Lunges', 'sets', 3, 'reps', 14),
          JSON_OBJECT('name', 'Calf Raises', 'sets', 4, 'reps', 15)
        )
      ),
      JSON_OBJECT(
        'day', 'Wednesday',
        'focus', 'Upper Body Push',
        'exercises', JSON_ARRAY(
          JSON_OBJECT('name', 'Bench Press', 'sets', 4, 'reps', 8),
          JSON_OBJECT('name', 'Overhead Press', 'sets', 3, 'reps', 10),
          JSON_OBJECT('name', 'Incline Dumbbell Press', 'sets', 3, 'reps', 12),
          JSON_OBJECT('name', 'Tricep Dips', 'sets', 3, 'reps', 12)
        )
      ),
      JSON_OBJECT(
        'day', 'Friday',
        'focus', 'Upper Body Pull',
        'exercises', JSON_ARRAY(
          JSON_OBJECT('name', 'Deadlifts', 'sets', 4, 'reps', 6),
          JSON_OBJECT('name', 'Pull-Ups', 'sets', 3, 'reps', 8),
          JSON_OBJECT('name', 'Barbell Rows', 'sets', 3, 'reps', 10),
          JSON_OBJECT('name', 'Bicep Curls', 'sets', 3, 'reps', 12)
        )
      )
    )
  ),
  'active'
);

INSERT INTO workout_progress (workout_plan_id, member_id, day_label, completed_at, notes) VALUES
(1, 7, 'Monday', '2026-06-09 18:30:00', 'Felt strong on squats');

-- ------------------------------------------------------------
-- Meetings (matches js/data.js SEED_MEETINGS)
-- ------------------------------------------------------------
INSERT INTO meetings (id, title, meeting_date, meeting_time, location, notes, created_by_user_id, status) VALUES
(1, 'Weekly Staff Sync',           '2026-06-20', '10:00:00', 'Main office', 'Review class coverage and member feedback.', 1, 'scheduled'),
(2, 'Safety & Equipment Review',   '2026-06-27', '09:30:00', 'Gym floor',   'Quarterly equipment check and incident reporting.', 1, 'scheduled');

INSERT INTO meeting_attendees (meeting_id, user_id, attendee_email, attendee_name, response_status) VALUES
(1, 2, 'trainer@shame.gym',       'Trainer User',  'invited'),
(1, 3, 'marcus.hale@shame.gym',   'Marcus Hale',   'accepted'),
(1, 4, 'nadia.petrova@shame.gym', 'Nadia Petrova', 'accepted'),
(2, 2, 'trainer@shame.gym',       'Trainer User',  'invited'),
(2, 5, 'diego.santos@shame.gym',  'Diego Santos',  'invited'),
(2, 7, 'tyler.brooks@shame.gym',  'Tyler Brooks',  'accepted');

-- ------------------------------------------------------------
-- Documents (metadata only; physical files added by PHP upload layer later)
-- ------------------------------------------------------------
INSERT INTO documents (id, title, description, category, keywords, original_filename, stored_filename, file_path, file_type, file_size, uploaded_by_user_id, is_available) VALUES
(1, 'Member Handbook 2026', 'Rules, etiquette, and facility guidelines for all members.', 'Policy', 'handbook, rules, members, policy', 'member-handbook-2026.pdf', 'doc_001_member_handbook.pdf', 'uploads/documents/doc_001_member_handbook.pdf', 'application/pdf', 245760, 1, 1),
(2, 'Trainer Safety Checklist', 'Pre-class safety checks for floor trainers.', 'Training', 'safety, trainer, checklist, equipment', 'trainer-safety-checklist.pdf', 'doc_002_trainer_safety.pdf', 'uploads/documents/doc_002_trainer_safety.pdf', 'application/pdf', 98304, 1, 1),
(3, 'Monthly Finance Summary Template', 'Admin template for monthly income/expense reporting.', 'Finance', 'finance, summary, admin, template', 'finance-summary-template.xlsx', 'doc_003_finance_template.xlsx', 'uploads/documents/doc_003_finance_template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 51200, 1, 1);

INSERT INTO document_access (document_id, role) VALUES
(1, 'admin'),
(1, 'trainer'),
(1, 'member'),
(2, 'admin'),
(2, 'trainer'),
(3, 'admin');

-- ------------------------------------------------------------
-- Polls / ballots (confidential voting demo)
-- ------------------------------------------------------------
INSERT INTO polls (id, question, description, status, opens_at, closes_at, created_by_user_id) VALUES
(1, 'Should we extend weekend opening hours?', 'Vote on adding one extra hour on Saturdays and Sundays.', 'open', '2026-06-01 00:00:00', '2026-06-30 23:59:59', 1),
(2, 'Preferred new group class format', 'Closed poll sample for results display testing.', 'closed', '2026-05-01 00:00:00', '2026-05-31 23:59:59', 1);

INSERT INTO poll_options (id, poll_id, option_text, display_order) VALUES
(1, 1, 'Yes, extend by 1 hour', 1),
(2, 1, 'No, keep current hours', 2),
(3, 1, 'Undecided / need more info', 3),
(4, 2, 'HIIT circuits', 1),
(5, 2, 'Mobility & recovery', 2),
(6, 2, 'Boxing fundamentals', 3);

-- Anonymous votes (no user_id) + receipts (duplicate prevention only)
INSERT INTO votes (poll_id, option_id, anonymous_vote_token, cast_at) VALUES
(1, 1, 'anon_token_poll1_vote_a1b2c3d4e5f6789012345678901234567890ab', '2026-06-05 12:00:00'),
(1, 2, 'anon_token_poll1_vote_b2c3d4e5f6789012345678901234567890abcd', '2026-06-06 09:30:00'),
(2, 4, 'anon_token_poll2_vote_c3d4e5f6789012345678901234567890abcdef', '2026-05-10 14:00:00'),
(2, 4, 'anon_token_poll2_vote_d4e5f6789012345678901234567890abcdef01', '2026-05-11 11:15:00'),
(2, 5, 'anon_token_poll2_vote_e5f6789012345678901234567890abcdef0123', '2026-05-12 16:45:00');

INSERT INTO vote_receipts (poll_id, user_id, voted_at) VALUES
(1, 8,  '2026-06-05 12:00:00'),
(1, 9,  '2026-06-06 09:30:00'),
(2, 10, '2026-05-10 14:00:00'),
(2, 11, '2026-05-11 11:15:00'),
(2, 12, '2026-05-12 16:45:00');

-- ------------------------------------------------------------
-- Finance transactions
-- ------------------------------------------------------------
INSERT INTO finance_transactions (transaction_type, category, amount, description, transaction_date, created_by_user_id) VALUES
('income',  'Membership',  1200.00, 'Premium membership renewals — June batch', '2026-06-01', 1),
('income',  'Membership',   450.00, 'Basic membership renewals — June batch',   '2026-06-03', 1),
('income',  'Retail',       180.50, 'Protein bar and supplement sales',       '2026-06-07', 1),
('expense', 'Utilities',    620.00, 'Electricity bill — May',                 '2026-06-02', 1),
('expense', 'Equipment',    350.00, 'Replacement resistance bands',           '2026-06-08', 1),
('expense', 'Supplies',      95.25, 'Cleaning supplies restock',                '2026-06-09', 1);

-- ------------------------------------------------------------
-- WhatsApp analytics sample (parsed export messages)
-- ------------------------------------------------------------
INSERT INTO whatsapp_imports (id, original_filename, stored_filename, uploaded_by_user_id, imported_at, status) VALUES
(1, 'shame-gym-group-chat.txt', 'wa_import_001.txt', 1, '2026-06-14 20:00:00', 'completed');

INSERT INTO whatsapp_messages (import_id, sender_name, message_text, message_datetime, message_date, message_hour, sentiment_score, sentiment_label, is_spam, spam_reason) VALUES
(1, 'James Carter',  'See you all at spin class tomorrow!', '2026-06-10 07:15:00', '2026-06-10', 7,  0.65, 'positive', 0, NULL),
(1, 'Nadia Petrova', 'Class moved to Studio B today.',      '2026-06-10 08:00:00', '2026-06-10', 8,  0.10, 'neutral',  0, NULL),
(1, 'Unknown User',  'CLICK HERE FOR FREE GYM PASS!!!',     '2026-06-10 08:05:00', '2026-06-10', 8, -0.20, 'negative', 1, 'Promotional spam pattern'),
(1, 'Sofia Romano',  'Thanks coach, great session.',        '2026-06-10 18:45:00', '2026-06-10', 18, 0.80, 'positive', 0, NULL),
(1, 'Liam Novak',    'Is yoga still on Saturday?',          '2026-06-11 09:10:00', '2026-06-11', 9,  0.05, 'neutral',  0, NULL);

INSERT INTO whatsapp_analysis_summary (import_id, total_messages, unique_senders, peak_hour, positive_count, neutral_count, negative_count, spam_count) VALUES
(1, 5, 5, 8, 2, 2, 1, 1);

-- ------------------------------------------------------------
-- Legacy import batch sample (small; full ~4000-row import tested later)
-- ------------------------------------------------------------
INSERT INTO import_batches (id, import_type, original_filename, stored_filename, total_rows, valid_rows, rejected_rows, imported_rows, status, created_by_user_id, created_at, completed_at) VALUES
(1, 'members_csv', 'legacy-members-sample.csv', 'import_batch_001.csv', 5, 3, 2, 3, 'partial', 1, '2026-06-13 10:00:00', '2026-06-13 10:05:00');

INSERT INTO import_errors (batch_id, row_number, raw_data, error_message) VALUES
(1, 2, 'John Doe,,Basic,2025-01-01', 'Missing required email address'),
(1, 4, 'Bad Email,not-an-email,Premium,2025-02-01', 'Invalid email format');

-- Reset AUTO_INCREMENT counters after explicit IDs
ALTER TABLE trainers AUTO_INCREMENT = 6;
ALTER TABLE members AUTO_INCREMENT = 8;
ALTER TABLE users AUTO_INCREMENT = 16;
ALTER TABLE classes AUTO_INCREMENT = 7;
ALTER TABLE workout_plans AUTO_INCREMENT = 2;
ALTER TABLE meetings AUTO_INCREMENT = 3;
ALTER TABLE documents AUTO_INCREMENT = 4;
ALTER TABLE polls AUTO_INCREMENT = 3;
ALTER TABLE poll_options AUTO_INCREMENT = 7;
ALTER TABLE whatsapp_imports AUTO_INCREMENT = 2;
ALTER TABLE import_batches AUTO_INCREMENT = 2;
