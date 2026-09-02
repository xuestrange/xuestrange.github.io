CREATE TABLE IF NOT EXISTS totals (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    page_views INTEGER NOT NULL DEFAULT 0,
    first_seen TEXT,
    last_seen TEXT
);

INSERT OR IGNORE INTO totals (id, page_views) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS daily_visitors (
    day_key TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    PRIMARY KEY (day_key, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_daily_visitors_day
    ON daily_visitors (day_key);

CREATE TABLE IF NOT EXISTS monthly_visitors (
    month_key TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    country_code TEXT NOT NULL,
    region TEXT NOT NULL,
    PRIMARY KEY (month_key, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_monthly_visitors_month
    ON monthly_visitors (month_key);

CREATE TABLE IF NOT EXISTS daily_pages (
    day_key TEXT NOT NULL,
    path TEXT NOT NULL,
    page_views INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (day_key, path)
);

CREATE INDEX IF NOT EXISTS idx_daily_pages_day
    ON daily_pages (day_key);

CREATE TABLE IF NOT EXISTS country_visit_totals (
    country_code TEXT PRIMARY KEY,
    visits INTEGER NOT NULL DEFAULT 0 CHECK (visits >= 0),
    first_visited_at TEXT NOT NULL,
    last_visited_at TEXT NOT NULL,
    CHECK (length(country_code) = 2)
);

CREATE TABLE IF NOT EXISTS recent_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visited_at TEXT NOT NULL,
    country_code TEXT NOT NULL,
    city TEXT NOT NULL,
    CHECK (length(country_code) = 2)
);

CREATE INDEX IF NOT EXISTS idx_recent_visits_order
    ON recent_visits (visited_at DESC, id DESC);
