-- Update schema to store authentication tokens in Supabase instead of local storage
-- Run this in Supabase SQL Editor to add authentication token storage

-- Add columns to store authentication session data
ALTER TABLE model_accounts 
ADD COLUMN auth_tokens JSONB DEFAULT '{}',  -- Store authentication tokens as JSON
ADD COLUMN session_cookies JSONB DEFAULT '{}',  -- Store session cookies as JSON
ADD COLUMN session_storage JSONB DEFAULT '{}',  -- Store session storage data as JSON
ADD COLUMN last_session_update TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update the existing records to have empty auth data
UPDATE model_accounts SET 
    auth_tokens = '{}',
    session_cookies = '{}', 
    session_storage = '{}',
    last_session_update = NOW()
WHERE auth_tokens IS NULL;

-- Add comment explaining the new columns
COMMENT ON COLUMN model_accounts.auth_tokens IS 'Stores authentication tokens (e.g., JWT tokens, auth keys) as JSON';
COMMENT ON COLUMN model_accounts.session_cookies IS 'Stores essential session cookies as JSON';
COMMENT ON COLUMN model_accounts.session_storage IS 'Stores session storage data as JSON';
COMMENT ON COLUMN model_accounts.last_session_update IS 'Timestamp of last session data update';