-- Create enum for LetzAI request status
CREATE TYPE letzai_request_status AS ENUM (
  'pending',
  'in_progress', 
  'completed',
  'failed'
);

-- Create LetzAI requests table for tracking usage and costs
CREATE TABLE letzai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request identification
  job_id TEXT, -- LetzAI job ID for tracking
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Request details
  endpoint TEXT NOT NULL, -- /images, /image-edits, /upscale, etc.
  model TEXT, -- Model used if applicable
  request_payload JSONB NOT NULL, -- Full request parameters
  
  -- Response tracking
  status letzai_request_status NOT NULL DEFAULT 'pending',
  response_data JSONB, -- Full response from LetzAI
  error TEXT, -- Error message if failed
  
  -- Performance and cost tracking
  cost_credits DECIMAL(10,4), -- Cost in credits/tokens
  latency_ms INTEGER, -- Request latency in milliseconds
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for efficient querying
CREATE INDEX idx_letzai_requests_team_id ON letzai_requests(team_id);
CREATE INDEX idx_letzai_requests_user_id ON letzai_requests(user_id);
CREATE INDEX idx_letzai_requests_status ON letzai_requests(status);
CREATE INDEX idx_letzai_requests_job_id ON letzai_requests(job_id);
CREATE INDEX idx_letzai_requests_created_at ON letzai_requests(created_at);
CREATE INDEX idx_letzai_requests_endpoint ON letzai_requests(endpoint);

-- Create composite index for analytics queries
CREATE INDEX idx_letzai_requests_team_status_created ON letzai_requests(team_id, status, created_at);

-- Add RLS policies
ALTER TABLE letzai_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see requests from their teams
CREATE POLICY "Users can view team letzai requests" ON letzai_requests
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert requests for their teams
CREATE POLICY "Users can create team letzai requests" ON letzai_requests
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update requests for their teams
CREATE POLICY "Users can update team letzai requests" ON letzai_requests
  FOR UPDATE USING (
    team_id IN (
      SELECT team_id FROM team_members 
      WHERE user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_letzai_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Set completed_at when status changes to completed or failed
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    NEW.completed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_letzai_requests_updated_at
  BEFORE UPDATE ON letzai_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_letzai_requests_updated_at();

-- Add comments for documentation
COMMENT ON TABLE letzai_requests IS 'Tracks all LetzAI API requests for usage monitoring and cost calculation';
COMMENT ON COLUMN letzai_requests.job_id IS 'LetzAI job ID returned from API for tracking async operations';
COMMENT ON COLUMN letzai_requests.endpoint IS 'LetzAI API endpoint used (/images, /image-edits, etc.)';
COMMENT ON COLUMN letzai_requests.request_payload IS 'Complete request parameters sent to LetzAI API';
COMMENT ON COLUMN letzai_requests.response_data IS 'Full response received from LetzAI API';
COMMENT ON COLUMN letzai_requests.cost_credits IS 'Calculated cost in credits based on LetzAI pricing';
COMMENT ON COLUMN letzai_requests.latency_ms IS 'Total request processing time in milliseconds';
