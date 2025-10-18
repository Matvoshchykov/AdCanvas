-- PixelBoard Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create pixels table
CREATE TABLE IF NOT EXISTS pixels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  color VARCHAR(7) NOT NULL,
  link TEXT,
  owner_id VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(x, y)
);

-- Create user_cooldowns table
CREATE TABLE IF NOT EXISTS user_cooldowns (
  user_id VARCHAR(255) PRIMARY KEY,
  last_placement TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pixels_coordinates ON pixels(x, y);
CREATE INDEX IF NOT EXISTS idx_pixels_created_at ON pixels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_cooldowns_last_placement ON user_cooldowns(user_id, last_placement);

-- Enable Row Level Security (RLS)
ALTER TABLE pixels ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cooldowns ENABLE ROW LEVEL SECURITY;

-- Create policies for pixels table (everyone can read, authenticated can insert)
CREATE POLICY "Anyone can view pixels" ON pixels
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert pixels" ON pixels
  FOR INSERT WITH CHECK (true);

-- Create policies for user_cooldowns (everyone can read their own, system can upsert)
CREATE POLICY "Users can view their own cooldown" ON user_cooldowns
  FOR SELECT USING (true);

CREATE POLICY "System can manage cooldowns" ON user_cooldowns
  FOR ALL USING (true);

-- Create a function to check if user can place a pixel
CREATE OR REPLACE FUNCTION can_place_pixel(p_user_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  last_placement TIMESTAMPTZ;
  cooldown_minutes INTEGER := 10;
BEGIN
  SELECT last_placement INTO last_placement
  FROM user_cooldowns
  WHERE user_id = p_user_id;
  
  IF last_placement IS NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN (EXTRACT(EPOCH FROM (NOW() - last_placement)) / 60) >= cooldown_minutes;
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for pixels table
ALTER PUBLICATION supabase_realtime ADD TABLE pixels;

-- Create a trigger to update user_cooldowns when a pixel is placed
CREATE OR REPLACE FUNCTION update_user_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_cooldowns (user_id, last_placement)
  VALUES (NEW.owner_id, NEW.created_at)
  ON CONFLICT (user_id)
  DO UPDATE SET last_placement = NEW.created_at;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cooldown_after_pixel_placement
AFTER INSERT ON pixels
FOR EACH ROW
EXECUTE FUNCTION update_user_cooldown();

