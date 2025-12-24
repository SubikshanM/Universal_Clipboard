-- Migration to add devices table for tracking user devices and online presence
-- Run this if you have an existing database

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255) NOT NULL,
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  ip_address VARCHAR(45),
  socket_id VARCHAR(255),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices (user_id);
CREATE INDEX IF NOT EXISTS idx_devices_online ON devices (user_id, is_online);
