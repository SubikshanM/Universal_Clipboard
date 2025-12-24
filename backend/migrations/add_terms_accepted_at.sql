-- Migration to add terms_accepted_at column to users table
-- Run this if you have an existing database

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

-- Optionally set existing users' terms_accepted_at to their created_at date
-- UPDATE users SET terms_accepted_at = created_at WHERE terms_accepted_at IS NULL;
