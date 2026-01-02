-- Schema for Webchat Bridge Gateway (MariaDB)
  
CREATE TABLE IF NOT EXISTS sessions (  
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,  
  session_uuid VARCHAR(64) NOT NULL,  
  visitor_id VARCHAR(64) NULL,  
  -- Optional: authenticated client id (null for guests)
  client_id VARCHAR(64) NULL,  
  mode VARCHAR(32) NOT NULL DEFAULT 'guest',  
  visitor_name VARCHAR(255) NULL,  
  visitor_email VARCHAR(255) NULL,  
  entry_url TEXT NULL,  
  referrer TEXT NULL,  
  discord_channel_id VARCHAR(32) NULL,  
  discord_thread_id VARCHAR(32) NULL,  
  last_page_url TEXT NULL,  
  last_seen_at TIMESTAMP NULL DEFAULT NULL,  
  geo_country VARCHAR(8) NULL,  
  geo_region VARCHAR(128) NULL,  
  geo_city VARCHAR(128) NULL,  
  geo_lat DECIMAL(10,7) NULL,  
  geo_lng DECIMAL(10,7) NULL,  
  geo_timezone VARCHAR(64) NULL,  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,  
  PRIMARY KEY (id),  
  UNIQUE KEY uniq_session_uuid (session_uuid)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;  
  
-- If an older DB was created without client_id, add it safely.  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client_id VARCHAR(64) NULL;  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(64) NULL;  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_page_url TEXT NULL;  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP NULL DEFAULT NULL;  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS geo_country VARCHAR(8) NULL;  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS geo_region VARCHAR(128) NULL;  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS geo_city VARCHAR(128) NULL;  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS geo_lat DECIMAL(10,7) NULL;  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS geo_lng DECIMAL(10,7) NULL;  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS geo_timezone VARCHAR(64) NULL;
  
CREATE TABLE IF NOT EXISTS messages (  
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,  
  session_uuid VARCHAR(64) NOT NULL,  
  direction VARCHAR(16) NOT NULL, -- 'visitor'|'agent'|'system'  
  author VARCHAR(255) NULL,  
  body TEXT NOT NULL,  
  discord_message_id VARCHAR(32) NULL,  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  
  PRIMARY KEY (id),  
  KEY idx_session_uuid (session_uuid),  
  CONSTRAINT fk_messages_session_uuid  
    FOREIGN KEY (session_uuid) REFERENCES sessions(session_uuid)  
    ON DELETE CASCADE  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_views (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  visitor_id VARCHAR(64) NULL,
  session_uuid VARCHAR(64) NULL,
  url TEXT NOT NULL,
  title VARCHAR(512) NULL,
  referrer TEXT NULL,
  ip VARCHAR(64) NULL,
  user_agent TEXT NULL,
  geo_country VARCHAR(8) NULL,
  geo_region VARCHAR(128) NULL,
  geo_city VARCHAR(128) NULL,
  geo_lat DECIMAL(10,7) NULL,
  geo_lng DECIMAL(10,7) NULL,
  geo_timezone VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pageviews_session (session_uuid),
  KEY idx_pageviews_visitor (visitor_id),
  KEY idx_pageviews_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
