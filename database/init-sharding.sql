-- VOTP Database Sharding Setup
-- This script sets up the database with foreign data wrappers for sharding

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgres_fdw";

-- Create the main database schema
\c votp_db;

-- Create users table (stored on master)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    bio TEXT,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_code_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create comments table (will be sharded)
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    url_hash VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create verification_codes table for temporary storage
CREATE TABLE IF NOT EXISTS verification_codes (
    email VARCHAR(255) PRIMARY KEY,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(verification_code) WHERE verification_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_url_hash ON comments(url_hash);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_normalized_url ON comments(normalized_url);

CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM verification_codes WHERE expires_at < NOW();
    DELETE FROM users WHERE email_verified = FALSE AND verification_code_expires_at < NOW();
END;
$$ language 'plpgsql';

-- URL normalization and hashing function
CREATE OR REPLACE FUNCTION normalize_and_hash_url(input_url TEXT)
RETURNS TABLE(normalized_url TEXT, url_hash TEXT) AS $$
DECLARE
    clean_url TEXT;
    hash_result TEXT;
BEGIN
    -- Basic URL normalization (simplified version)
    -- Remove trailing slash unless it's root
    clean_url := regexp_replace(input_url, '/$', '');
    IF clean_url = '' THEN
        clean_url := '/';
    END IF;
    
    -- Convert to lowercase
    clean_url := lower(clean_url);
    
    -- Remove common tracking parameters (simplified)
    clean_url := regexp_replace(clean_url, '[?&](utm_[^&]*|fbclid[^&]*|gclid[^&]*|ref[^&]*)', '', 'g');
    clean_url := regexp_replace(clean_url, '[?&]$', '');
    
    -- Generate SHA256 hash
    hash_result := encode(digest(clean_url, 'sha256'), 'hex');
    
    RETURN QUERY SELECT clean_url, hash_result;
END;
$$ language 'plpgsql';

-- Create a function to determine which shard a comment should go to
CREATE OR REPLACE FUNCTION get_comment_shard(url_hash TEXT)
RETURNS INTEGER AS $$
BEGIN
    -- Simple hash-based sharding
    -- Use the first character of the hash to determine shard
    CASE substring(url_hash, 1, 1)
        WHEN '0', '1', '2', '3', '4', '5' THEN RETURN 1;
        WHEN '6', '7', '8', '9', 'a', 'b' THEN RETURN 2;
        ELSE RETURN 0; -- Master
    END CASE;
END;
$$ language 'plpgsql';

-- Insert some sample data for testing
INSERT INTO users (name, email, password_hash, email_verified) VALUES 
    ('Test User', 'test@example.com', '$argon2id$v=19$m=4096,t=3,p=1$fakehashjustfortesting', true),
    ('Demo User', 'demo@example.com', '$argon2id$v=19$m=4096,t=3,p=1$fakehashjustfortesting', true)
ON CONFLICT (email) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Create a view for comment statistics
CREATE OR REPLACE VIEW comment_stats AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as comment_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT url_hash) as unique_urls
FROM comments 
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Create a view for popular URLs
CREATE OR REPLACE VIEW popular_urls AS
SELECT 
    normalized_url,
    url_hash,
    COUNT(*) as comment_count,
    MAX(created_at) as last_comment_at,
    COUNT(DISTINCT user_id) as unique_commenters
FROM comments 
GROUP BY normalized_url, url_hash
ORDER BY comment_count DESC, last_comment_at DESC;

COMMIT;