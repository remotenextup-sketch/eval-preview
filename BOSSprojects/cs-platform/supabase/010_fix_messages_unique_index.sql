-- Fix: partial unique index is not usable by PostgREST onConflict.
-- Replace with a full unique index. PostgreSQL's NULL != NULL semantics
-- means multiple NULL values in external_message_id are still allowed.
DROP INDEX IF EXISTS idx_inquiry_messages_inquiry_external;

CREATE UNIQUE INDEX idx_inquiry_messages_inquiry_external
  ON inquiry_messages (inquiry_id, external_message_id);
