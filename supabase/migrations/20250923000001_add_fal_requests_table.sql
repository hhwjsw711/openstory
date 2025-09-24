-- Add fal_requests table for tracking Fal.ai API usage and responses
-- This table tracks all requests made to Fal.ai for usage monitoring, cost calculation, and caching

-- Create enum for request status
CREATE TYPE fal_request_status AS ENUM ('pending', 'completed', 'failed');

-- Create fal_requests table
CREATE TABLE fal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    model VARCHAR(255) NOT NULL,
    request_payload JSONB NOT NULL DEFAULT '{}',
    response_data JSONB,
    cost_credits DECIMAL(10,4) DEFAULT 0,
    latency_ms INTEGER,
    status fal_request_status NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_fal_requests_job_id ON fal_requests(job_id);
CREATE INDEX idx_fal_requests_team_id ON fal_requests(team_id);
CREATE INDEX idx_fal_requests_user_id ON fal_requests(user_id);
CREATE INDEX idx_fal_requests_model ON fal_requests(model);
CREATE INDEX idx_fal_requests_status ON fal_requests(status);

CREATE INDEX idx_fal_requests_created_at ON fal_requests(created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_fal_requests_updated_at 
    BEFORE UPDATE ON fal_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE fal_requests ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy for API access
CREATE POLICY "Service role bypass" ON fal_requests FOR ALL USING (true);

-- Add comment explaining the table purpose
COMMENT ON TABLE fal_requests IS 'Tracks all Fal.ai API requests for usage monitoring, cost calculation, response caching, and analytics. Includes both successful and failed requests with detailed metadata.';

-- Add column comments for clarity
COMMENT ON COLUMN fal_requests.cost_credits IS 'Cost in credits/dollars for this request';
COMMENT ON COLUMN fal_requests.latency_ms IS 'Request latency in milliseconds from start to completion';
COMMENT ON COLUMN fal_requests.request_payload IS 'Original request parameters sent to Fal.ai';
COMMENT ON COLUMN fal_requests.response_data IS 'Full response data from Fal.ai API';
