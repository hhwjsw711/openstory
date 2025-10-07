-- Team Invitations Migration
-- Creates table for managing team member invitations

-- Create invitation status enum
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Create team_invitations table
CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role team_member_role NOT NULL DEFAULT 'member',
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status invitation_status NOT NULL DEFAULT 'pending',
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_status ON team_invitations(status);
CREATE INDEX idx_team_invitations_expires_at ON team_invitations(expires_at);

-- Create unique constraint to prevent duplicate pending invitations
CREATE UNIQUE INDEX idx_team_invitations_unique_pending 
ON team_invitations(team_id, email) 
WHERE status = 'pending';

-- Add trigger for updated_at
CREATE TRIGGER update_team_invitations_updated_at 
BEFORE UPDATE ON team_invitations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
    UPDATE team_invitations
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for team_invitations
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy
CREATE POLICY "Service role bypass" ON team_invitations FOR ALL USING (true);

-- Add comment explaining the table
COMMENT ON TABLE team_invitations IS 'Stores team member invitations with expiration and status tracking. Invitations expire after 7 days.';
COMMENT ON COLUMN team_invitations.token IS 'Unique token for accepting invitation via email link';
COMMENT ON COLUMN team_invitations.role IS 'Role to assign when invitation is accepted (default: member)';

