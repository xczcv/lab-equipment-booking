export const availableSlotsSql = `
  SELECT s.id, s.equipment_id, s.starts_at, s.ends_at
  FROM equipment AS e
  LEFT JOIN LATERAL (
    SELECT s.id, s.equipment_id, s.starts_at, s.ends_at
    FROM slots AS s
    WHERE s.equipment_id = e.id
      AND s.starts_at >= ($2::date::timestamp AT TIME ZONE 'Europe/Kyiv')
      AND s.starts_at < (($2::date + 1)::timestamp AT TIME ZONE 'Europe/Kyiv')
      AND s.starts_at > $3::timestamptz
      AND NOT EXISTS (
        SELECT 1 FROM bookings AS b
        WHERE b.slot_id = s.id AND b.cancelled_at IS NULL
      )
  ) AS s ON true
  WHERE e.id = $1
  ORDER BY s.starts_at
`;
