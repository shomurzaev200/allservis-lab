-- Team access, extra client bots, and a logs bot.
create table if not exists as_staff (
  id serial primary key,
  workspace_id text not null,
  user_id text,
  email text not null,
  name text not null default '',
  role text not null default 'admin',
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);
create unique index if not exists as_staff_user_idx on as_staff (user_id) where user_id is not null;
create index if not exists as_staff_ws_idx on as_staff (workspace_id);

create table if not exists as_bots (
  id serial primary key,
  user_id text not null,
  kind text not null default 'client',
  label text not null default 'Бот',
  bot_token text,
  bot_username text,
  bot_secret text,
  webhook_id text,
  log_chat_id text,
  connected_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists as_bots_hook_idx on as_bots (webhook_id);
create index if not exists as_bots_user_idx on as_bots (user_id);
