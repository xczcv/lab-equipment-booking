CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS bookings_one_active_idx
ON bookings (slot_id) WHERE cancelled_at IS NULL;
