-- 添加埋点事件表：渠道归因与转化漏斗分析
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  user_id INTEGER,
  page TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  properties TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX analytics_events_event_idx ON analytics_events(event);
CREATE INDEX analytics_events_created_at_idx ON analytics_events(created_at);
CREATE INDEX analytics_events_utm_source_idx ON analytics_events(utm_source);
CREATE INDEX analytics_events_user_id_idx ON analytics_events(user_id);
