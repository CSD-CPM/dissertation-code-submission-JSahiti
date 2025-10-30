-- =====================================================================
--  Grade-Assist Mini — Core + Auth Schema (MySQL 8+)
--  UPDATED: Per-user ownership on courses & sessions
-- =====================================================================

CREATE DATABASE IF NOT EXISTS grade_assist_mini
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE grade_assist_mini;

-- ---------------------------------------------------------------------
-- Auth: Users / Sessions / Password resets  (placed first for FKs)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_users_email (email)
);

-- Server-side session store (remember-me / cookie session tokens)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_token CHAR(64) NOT NULL,         -- store a hex/sha256 token
  user_agent VARCHAR(255) NULL,
  ip VARBINARY(16) NULL,                   -- IPv4/IPv6 (INET6_ATON)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_session_token (session_token),
  KEY idx_sessions_user (user_id)
);

-- Password reset links (one-time tokens, short expiration)
CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  reset_token CHAR(64) NOT NULL,           -- store a hex/sha256 token
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL,
  expires_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_reset_token (reset_token),
  KEY idx_pr_user (user_id)
);

-- ---------------------------------------------------------------------
-- Courses / Sessions / Criteria / Summaries (existing, with ownership)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT NOT NULL,                  -- NEW: per-user ownership
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  term VARCHAR(64) NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uniq_course_per_owner (owner_user_id, code, term)  -- changed
);

CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  owner_user_id INT NOT NULL,                  -- NEW: per-user ownership
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Guard rails: session owner must match its course owner
DROP TRIGGER IF EXISTS trg_sessions_owner_guard_ins;
DROP TRIGGER IF EXISTS trg_sessions_owner_guard_upd;
DELIMITER $$
CREATE TRIGGER trg_sessions_owner_guard_ins
BEFORE INSERT ON sessions
FOR EACH ROW
BEGIN
  DECLARE course_owner INT;
  SELECT owner_user_id INTO course_owner FROM courses WHERE id = NEW.course_id;
  IF course_owner IS NULL OR course_owner <> NEW.owner_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Session owner mismatch with Course owner';
  END IF;
END$$

CREATE TRIGGER trg_sessions_owner_guard_upd
BEFORE UPDATE ON sessions
FOR EACH ROW
BEGIN
  DECLARE course_owner INT;
  DECLARE cid INT;
  SET cid = COALESCE(NEW.course_id, OLD.course_id);
  SELECT owner_user_id INTO course_owner FROM courses WHERE id = cid;
  IF course_owner IS NULL OR course_owner <> NEW.owner_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Session owner mismatch with Course owner';
  END IF;
END$$
DELIMITER ;

CREATE TABLE IF NOT EXISTS criteria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  question_no INT NOT NULL,
  label VARCHAR(512) NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_criterion (session_id, question_no)
);

CREATE TABLE IF NOT EXISTS summary_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  criteria_id INT NOT NULL,
  team VARCHAR(64) NOT NULL,
  recipient VARCHAR(128) NOT NULL,
  recipient_email VARCHAR(255) NULL,
  total_points INT NOT NULL,
  average_points DECIMAL(10,2) NULL,
  FOREIGN KEY (criteria_id) REFERENCES criteria(id) ON DELETE CASCADE,
  KEY idx_summary_stats_crit (criteria_id),
  KEY idx_summary_stats_team_rec (team, recipient)
);

CREATE TABLE IF NOT EXISTS summary_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  summary_id INT NOT NULL,
  idx INT NOT NULL,
  value INT NULL,
  FOREIGN KEY (summary_id) REFERENCES summary_stats(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_summary_idx (summary_id, idx),
  KEY idx_summary_points_summary (summary_id)
);

CREATE TABLE IF NOT EXISTS pa_not_submitted (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  team VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(255) NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_session_team_name (session_id, team, name),
  KEY idx_pa_ns_session (session_id)
);

CREATE TABLE IF NOT EXISTS grading_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  pa_weight DECIMAL(5,2) NOT NULL DEFAULT 10.00,     -- percent (0..100)
  num_criteria INT NULL,
  penalty_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- percent (0..100)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_gc_session (session_id)
);

CREATE TABLE IF NOT EXISTS group_marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  team VARCHAR(64) NOT NULL,
  group_mark DECIMAL(6,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_group_mark (session_id, team),
  KEY idx_group_marks_session (session_id)
);

-- ---------------------------------------------------------------------
-- Helpful View used by /api/grade-breakdown
-- Computes: "sum of per-criterion averages", rounded to 2dp
-- (now includes owner_user_id for safe, cheap filtering)
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW v_avg_points_sum_of_per_criterion_avgs AS
SELECT
  pc.session_id,
  s.owner_user_id,
  pc.team,
  pc.student,
  ROUND(
    SUM(
      CASE WHEN pc.num_idx > 0
           THEN pc.sum_points / pc.num_idx
           ELSE 0
      END
    ),
    2
  ) AS average_points
FROM (
  SELECT
    c.session_id,
    ss.team,
    ss.recipient AS student,
    SUM(CASE WHEN sp.value IS NOT NULL THEN sp.value ELSE 0 END) AS sum_points,
    SUM(CASE WHEN sp.value IS NOT NULL THEN 1 ELSE 0 END)        AS num_idx
  FROM summary_stats ss
  JOIN criteria c       ON c.id = ss.criteria_id
  LEFT JOIN summary_points sp ON sp.summary_id = ss.id
  GROUP BY c.session_id, ss.team, ss.recipient, ss.id
) pc
JOIN sessions s ON s.id = pc.session_id
GROUP BY pc.session_id, s.owner_user_id, pc.team, pc.student;

-- =====================================================================
-- End of schema
-- =====================================================================
