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

PRAGMA optimize;
