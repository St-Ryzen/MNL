-- Complete schema update for Maloum Chatter Control
-- Run this in Supabase SQL Editor to add all required columns

-- Add all authentication and session management columns to model_accounts table
ALTER TABLE model_accounts 
ADD COLUMN IF NOT EXISTS auth_tokens JSONB DEFAULT '{}',  -- Store authentication tokens (localStorage) as JSON
ADD COLUMN IF NOT EXISTS session_cookies JSONB DEFAULT '{}',  -- Store session cookies as JSON  
ADD COLUMN IF NOT EXISTS session_storage JSONB DEFAULT '{}',  -- Store session storage data as JSON
ADD COLUMN IF NOT EXISTS last_session_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS browser_profile_backup TEXT DEFAULT NULL;  -- Store base64 encoded browser profile backup

-- Update existing records to have proper defaults where needed
UPDATE model_accounts SET 
    auth_tokens = '{}',
    session_cookies = '{}', 
    session_storage = '{}',
    last_session_update = NOW()
WHERE auth_tokens IS NULL OR session_cookies IS NULL OR session_storage IS NULL;

-- Add comments explaining the new columns
COMMENT ON COLUMN model_accounts.auth_tokens IS 'Stores authentication tokens (e.g., JWT tokens, auth keys) as JSON for session restoration';
COMMENT ON COLUMN model_accounts.session_cookies IS 'Stores essential session cookies as JSON for session restoration';
COMMENT ON COLUMN model_accounts.session_storage IS 'Stores session storage data as JSON for session restoration';
COMMENT ON COLUMN model_accounts.last_session_update IS 'Timestamp of last session data update';
COMMENT ON COLUMN model_accounts.browser_profile_backup IS 'Base64-encoded backup of entire browser profile including extensions and settings';