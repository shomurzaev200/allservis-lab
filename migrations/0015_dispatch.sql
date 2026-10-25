alter table as_masters add column if not exists last_offered_at timestamptz;

create table if not exists as_alert_threads (
  user_id text not null,
  channel_id text not null,
  message_id bigint not null,
  client_chat_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, channel_id, message_id)
);
create index if not exists as_alert_threads_msg_idx on as_alert_threads (user_id, message_id);
