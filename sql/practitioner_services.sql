CREATE TABLE IF NOT EXISTS practitioner_services (
  practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (practitioner_id, service_id)
);
