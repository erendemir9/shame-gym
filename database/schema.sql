-- ============================================================
-- SHAME Gym — Sprint 3 Database Schema
-- Database: shame_gym_db
-- Engine: InnoDB | Charset: utf8mb4
-- Compatible with MariaDB 10.4+ / MySQL 5.7+ (XAMPP)
-- Import via phpMyAdmin or mysql CLI (see project docs).
-- ============================================================

CREATE DATABASE IF NOT EXISTS shame_gym_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE shame_gym_db;

SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables in reverse dependency order (safe reset for fresh import).
DROP TABLE IF EXISTS import_errors;
DROP TABLE IF EXISTS import_batches;
DROP TABLE IF EXISTS whatsapp_analysis_summary;
DROP TABLE IF EXISTS whatsapp_messages;
DROP TABLE IF EXISTS whatsapp_imports;
DROP TABLE IF EXISTS finance_transactions;
DROP TABLE IF EXISTS vote_receipts;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS poll_options;
DROP TABLE IF EXISTS polls;
DROP TABLE IF EXISTS document_access;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS meeting_attendees;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS workout_progress;
DROP TABLE IF EXISTS workout_plans;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS trainers;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- A. Core Auth / Users
-- ------------------------------------------------------------

CREATE TABLE trainers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  specialization VARCHAR(80) DEFAULT NULL,
  availability VARCHAR(80) DEFAULT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_trainers_email (email),
  KEY idx_trainers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Trainer profiles for class assignment and member linking';

CREATE TABLE members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(40) DEFAULT NULL,
  membership_type ENUM('Basic', 'Premium', 'VIP') NOT NULL DEFAULT 'Basic',
  start_date DATE DEFAULT NULL,
  assigned_trainer_id INT UNSIGNED DEFAULT NULL,
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_members_email (email),
  KEY idx_members_assigned_trainer (assigned_trainer_id),
  KEY idx_members_status (status),
  KEY idx_members_membership_type (membership_type),
  CONSTRAINT fk_members_assigned_trainer
    FOREIGN KEY (assigned_trainer_id) REFERENCES trainers (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Gym member records; supports legacy CSV import';

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) DEFAULT NULL COMMENT 'bcrypt hash; NULL until account activation',
  full_name VARCHAR(120) NOT NULL,
  role ENUM('admin', 'trainer', 'member') NOT NULL,
  linked_member_id INT UNSIGNED DEFAULT NULL,
  linked_trainer_id INT UNSIGNED DEFAULT NULL,
  needs_password_setup TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_linked_member (linked_member_id),
  KEY idx_users_linked_trainer (linked_trainer_id),
  CONSTRAINT fk_users_linked_member
    FOREIGN KEY (linked_member_id) REFERENCES members (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_users_linked_trainer
    FOREIGN KEY (linked_trainer_id) REFERENCES trainers (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Login accounts with role-based access; links to member/trainer profiles';

-- ------------------------------------------------------------
-- D. Classes / Schedules
-- ------------------------------------------------------------

CREATE TABLE classes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  class_name VARCHAR(120) NOT NULL,
  trainer_id INT UNSIGNED NOT NULL,
  class_date DATE NOT NULL,
  class_time TIME NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  capacity SMALLINT UNSIGNED NOT NULL,
  status ENUM('scheduled', 'cancelled', 'completed') NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_classes_trainer (trainer_id),
  KEY idx_classes_date (class_date),
  KEY idx_classes_status (status),
  CONSTRAINT fk_classes_trainer
    FOREIGN KEY (trainer_id) REFERENCES trainers (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_classes_capacity CHECK (capacity > 0),
  CONSTRAINT chk_classes_duration CHECK (duration_minutes > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Scheduled gym classes (frontend schedules page)';

-- ------------------------------------------------------------
-- E. Enrollments
-- ------------------------------------------------------------

CREATE TABLE enrollments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  class_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('enrolled', 'cancelled', 'attended') NOT NULL DEFAULT 'enrolled',
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollments_class_member (class_id, member_id),
  KEY idx_enrollments_member (member_id),
  KEY idx_enrollments_status (status),
  CONSTRAINT fk_enrollments_class
    FOREIGN KEY (class_id) REFERENCES classes (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_enrollments_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Member enrollment in classes; unique per class+member';

-- ------------------------------------------------------------
-- F. Workout Plans
-- ------------------------------------------------------------

CREATE TABLE workout_plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id INT UNSIGNED NOT NULL,
  trainer_id INT UNSIGNED NOT NULL,
  plan_name VARCHAR(160) NOT NULL,
  notes TEXT DEFAULT NULL,
  plan_details JSON NOT NULL COMMENT 'Structured days/exercises JSON from trainer',
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_workout_plans_member (member_id),
  KEY idx_workout_plans_trainer (trainer_id),
  KEY idx_workout_plans_status (status),
  CONSTRAINT fk_workout_plans_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_workout_plans_trainer
    FOREIGN KEY (trainer_id) REFERENCES trainers (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Trainer-authored workout plans assigned to members';

CREATE TABLE workout_progress (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  workout_plan_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  day_label VARCHAR(40) NOT NULL COMMENT 'e.g. Monday',
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workout_progress_plan_day (workout_plan_id, day_label),
  KEY idx_workout_progress_member (member_id),
  CONSTRAINT fk_workout_progress_plan
    FOREIGN KEY (workout_plan_id) REFERENCES workout_plans (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_workout_progress_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tracks completed workout days per plan';

-- ------------------------------------------------------------
-- G. Meetings
-- ------------------------------------------------------------

CREATE TABLE meetings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME NOT NULL,
  location VARCHAR(120) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_by_user_id INT UNSIGNED DEFAULT NULL,
  status ENUM('scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_meetings_date (meeting_date),
  KEY idx_meetings_status (status),
  CONSTRAINT fk_meetings_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Staff/admin meetings';

CREATE TABLE meeting_attendees (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  meeting_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED DEFAULT NULL,
  attendee_email VARCHAR(191) NOT NULL COMMENT 'Denormalized for staff without user accounts',
  attendee_name VARCHAR(120) DEFAULT NULL,
  response_status ENUM('invited', 'accepted', 'declined') NOT NULL DEFAULT 'invited',
  PRIMARY KEY (id),
  UNIQUE KEY uq_meeting_attendees_meeting_email (meeting_id, attendee_email),
  KEY idx_meeting_attendees_user (user_id),
  CONSTRAINT fk_meeting_attendees_meeting
    FOREIGN KEY (meeting_id) REFERENCES meetings (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_meeting_attendees_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Meeting invite list; email retained for legacy frontend parity';

-- ------------------------------------------------------------
-- H. Documents
-- ------------------------------------------------------------

CREATE TABLE documents (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'General',
  keywords VARCHAR(500) DEFAULT NULL COMMENT 'Comma-separated search terms',
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL COMMENT 'Relative path under uploads/ (PHP layer later)',
  file_type VARCHAR(120) DEFAULT NULL,
  file_size INT UNSIGNED DEFAULT NULL COMMENT 'Bytes',
  uploaded_by_user_id INT UNSIGNED DEFAULT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_documents_category (category),
  KEY idx_documents_uploaded_by (uploaded_by_user_id),
  KEY idx_documents_is_available (is_available),
  FULLTEXT KEY ft_documents_search (title, description, keywords),
  CONSTRAINT fk_documents_uploaded_by
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Uploaded document metadata; files stored on disk by PHP later';

CREATE TABLE document_access (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id INT UNSIGNED NOT NULL,
  role ENUM('admin', 'trainer', 'member') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_document_access_document_role (document_id, role),
  CONSTRAINT fk_document_access_document
    FOREIGN KEY (document_id) REFERENCES documents (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Role-based document visibility rules';

-- ------------------------------------------------------------
-- I. Polls / Ballots (confidential voting)
-- ------------------------------------------------------------

CREATE TABLE polls (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  question VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  status ENUM('draft', 'open', 'closed') NOT NULL DEFAULT 'draft',
  opens_at DATETIME DEFAULT NULL,
  closes_at DATETIME DEFAULT NULL,
  created_by_user_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_polls_status (status),
  KEY idx_polls_opens_at (opens_at),
  KEY idx_polls_closes_at (closes_at),
  CONSTRAINT fk_polls_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Organization ballots/polls';

CREATE TABLE poll_options (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  poll_id INT UNSIGNED NOT NULL,
  option_text VARCHAR(255) NOT NULL,
  display_order TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_poll_options_poll (poll_id),
  CONSTRAINT fk_poll_options_poll
    FOREIGN KEY (poll_id) REFERENCES polls (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Selectable answers for each poll';

CREATE TABLE votes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  poll_id INT UNSIGNED NOT NULL,
  option_id INT UNSIGNED NOT NULL,
  anonymous_vote_token CHAR(64) NOT NULL COMMENT 'Random token; not linked to user_id',
  cast_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_votes_anonymous_token (anonymous_vote_token),
  KEY idx_votes_poll (poll_id),
  KEY idx_votes_option (option_id),
  CONSTRAINT fk_votes_poll
    FOREIGN KEY (poll_id) REFERENCES polls (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_votes_option
    FOREIGN KEY (option_id) REFERENCES poll_options (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Anonymous ballot selections; no user_id stored for confidentiality';

CREATE TABLE vote_receipts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  poll_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  voted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vote_receipts_poll_user (poll_id, user_id),
  KEY idx_vote_receipts_user (user_id),
  CONSTRAINT fk_vote_receipts_poll
    FOREIGN KEY (poll_id) REFERENCES polls (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_vote_receipts_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Duplicate-vote prevention only; does not reveal chosen option';

-- ------------------------------------------------------------
-- J. Finance
-- ------------------------------------------------------------

CREATE TABLE finance_transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_type ENUM('income', 'expense') NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  transaction_date DATE NOT NULL,
  created_by_user_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_type (transaction_type),
  KEY idx_finance_category (category),
  KEY idx_finance_transaction_date (transaction_date),
  CONSTRAINT fk_finance_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_finance_amount_positive CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Income and expense ledger for finance summaries';

-- ------------------------------------------------------------
-- K. WhatsApp Analytics (uploaded .txt exports only)
-- ------------------------------------------------------------

CREATE TABLE whatsapp_imports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  uploaded_by_user_id INT UNSIGNED DEFAULT NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  PRIMARY KEY (id),
  KEY idx_whatsapp_imports_status (status),
  CONSTRAINT fk_whatsapp_imports_uploaded_by
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Uploaded WhatsApp group chat export files';

CREATE TABLE whatsapp_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_id INT UNSIGNED NOT NULL,
  sender_name VARCHAR(120) NOT NULL,
  message_text TEXT DEFAULT NULL,
  message_datetime DATETIME NOT NULL,
  message_date DATE NOT NULL,
  message_hour TINYINT UNSIGNED NOT NULL COMMENT '0-23 for peak-hour analytics',
  sentiment_score DECIMAL(5, 2) DEFAULT NULL COMMENT 'Optional NLP score e.g. -1.00 to 1.00',
  sentiment_label ENUM('positive', 'neutral', 'negative') DEFAULT 'neutral',
  is_spam TINYINT(1) NOT NULL DEFAULT 0,
  spam_reason VARCHAR(120) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_whatsapp_messages_import (import_id),
  KEY idx_whatsapp_messages_sender (sender_name),
  KEY idx_whatsapp_messages_date (message_date),
  KEY idx_whatsapp_messages_hour (message_hour),
  KEY idx_whatsapp_messages_sentiment (sentiment_label),
  KEY idx_whatsapp_messages_spam (is_spam),
  CONSTRAINT fk_whatsapp_messages_import
    FOREIGN KEY (import_id) REFERENCES whatsapp_imports (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Parsed messages from WhatsApp .txt export';

CREATE TABLE whatsapp_analysis_summary (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_id INT UNSIGNED NOT NULL,
  total_messages INT UNSIGNED NOT NULL DEFAULT 0,
  unique_senders INT UNSIGNED NOT NULL DEFAULT 0,
  peak_hour TINYINT UNSIGNED DEFAULT NULL,
  positive_count INT UNSIGNED NOT NULL DEFAULT 0,
  neutral_count INT UNSIGNED NOT NULL DEFAULT 0,
  negative_count INT UNSIGNED NOT NULL DEFAULT 0,
  spam_count INT UNSIGNED NOT NULL DEFAULT 0,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_whatsapp_summary_import (import_id),
  CONSTRAINT fk_whatsapp_summary_import
    FOREIGN KEY (import_id) REFERENCES whatsapp_imports (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Precomputed dashboard metrics per WhatsApp import';

-- ------------------------------------------------------------
-- L. Legacy Import
-- ------------------------------------------------------------

CREATE TABLE import_batches (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  import_type VARCHAR(60) NOT NULL COMMENT 'e.g. members_csv',
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  total_rows INT UNSIGNED NOT NULL DEFAULT 0,
  valid_rows INT UNSIGNED NOT NULL DEFAULT 0,
  rejected_rows INT UNSIGNED NOT NULL DEFAULT 0,
  imported_rows INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('pending', 'processing', 'completed', 'failed', 'partial') NOT NULL DEFAULT 'pending',
  created_by_user_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_import_batches_type (import_type),
  KEY idx_import_batches_status (status),
  CONSTRAINT fk_import_batches_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tracks bulk legacy record imports (~4000 rows later)';

CREATE TABLE import_errors (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id INT UNSIGNED NOT NULL,
  row_number INT UNSIGNED NOT NULL,
  raw_data TEXT DEFAULT NULL COMMENT 'Original CSV row for debugging',
  error_message VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_import_errors_batch (batch_id),
  CONSTRAINT fk_import_errors_batch
    FOREIGN KEY (batch_id) REFERENCES import_batches (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Rejected rows from legacy import with validation errors';
