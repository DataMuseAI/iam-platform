-- Dedicated web-db only. Do not store IdP credentials in IAM application tables.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE oauth_flows (
 state_hash bytea PRIMARY KEY, browser_hash bytea NOT NULL,
 verifier_enc text NOT NULL, nonce text NOT NULL, return_to text NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE TABLE web_sessions (
 id_hash bytea PRIMARY KEY, subject text NOT NULL, csrf text NOT NULL,
 access_enc text NOT NULL, refresh_enc text NOT NULL,
 access_expires_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX web_sessions_expiry ON web_sessions(expires_at);
CREATE INDEX oauth_flows_expiry ON oauth_flows(expires_at);
