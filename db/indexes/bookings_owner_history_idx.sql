CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_owner_history_idx
ON bookings (user_id, created_at DESC, id DESC);
