-- Basic initialization script for Supabase
-- This creates some initial database objects if needed

-- Create a simple test table
CREATE TABLE IF NOT EXISTS public.test_table (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert some test data
INSERT INTO public.test_table (name) VALUES ('Test entry') ON CONFLICT DO NOTHING;