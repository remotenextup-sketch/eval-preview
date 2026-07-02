-- Add external_message_id for dedup of inbound messages synced from external sources (e.g., Rakuten replies[])
ALTER TABLE inquiry_messages
  ADD COLUMN IF NOT EXISTS external_message_id TEXT;

-- Composite unique index: per inquiry, so {inquiryNumber}::0 is unique within each inquiry
CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_external
  ON inquiry_messages (inquiry_id, external_message_id)
  WHERE external_message_id IS NOT NULL;
