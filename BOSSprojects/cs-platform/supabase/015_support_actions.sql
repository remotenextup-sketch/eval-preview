CREATE TABLE IF NOT EXISTS support_actions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id           uuid REFERENCES inquiries(id) ON DELETE CASCADE,
  message_id           uuid REFERENCES inquiry_messages(id),
  order_id             text,
  mall                 text,
  order_number         text,
  customer_name        text,
  product_id           text,
  sku                  text,
  product_name         text,
  quantity             integer,
  action_type          text NOT NULL,
  reason_category      text,
  reason_detail        text,
  refund_amount        numeric,
  replacement_quantity integer,
  estimated_loss_amount numeric,
  staff_id             uuid REFERENCES users(id),
  detection_source     text DEFAULT 'ai',
  ai_confidence        numeric,
  status               text NOT NULL DEFAULT 'auto_saved',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- 重複防止（同一 inquiry_id + message_id + action_type + sku + refund_amount）
CREATE UNIQUE INDEX IF NOT EXISTS support_actions_dedup_idx
  ON support_actions (
    inquiry_id,
    message_id,
    action_type,
    COALESCE(sku, ''),
    COALESCE(refund_amount::text, '')
  );

CREATE INDEX IF NOT EXISTS support_actions_inquiry_idx    ON support_actions (inquiry_id);
CREATE INDEX IF NOT EXISTS support_actions_created_at_idx ON support_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS support_actions_status_idx     ON support_actions (status);
CREATE INDEX IF NOT EXISTS support_actions_mall_idx       ON support_actions (mall);
