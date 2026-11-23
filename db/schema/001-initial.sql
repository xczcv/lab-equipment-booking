CREATE TABLE equipment (
  id integer PRIMARY KEY,
  name text NOT NULL,
  CHECK (id > 0)
);

CREATE TABLE students (
  id text PRIMARY KEY
);

CREATE TABLE slots (
  id integer PRIMARY KEY,
  equipment_id integer NOT NULL REFERENCES equipment,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  UNIQUE (equipment_id, starts_at),
  CHECK (id > 0 AND starts_at < ends_at)
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES students,
  slot_id integer NOT NULL REFERENCES slots,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cancelled_at timestamptz
);

CREATE TABLE booking_receipts (
  user_id text NOT NULL REFERENCES students,
  request_key text NOT NULL,
  slot_id integer NOT NULL,
  response jsonb,
  PRIMARY KEY (user_id, request_key)
);
