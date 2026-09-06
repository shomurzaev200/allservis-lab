-- Bot columns, polling, payment requisites, tg sessions.
alter table as_workspace add column if not exists bot_token text;
alter table as_workspace add column if not exists bot_username text;
alter table as_workspace add column if not exists bot_secret text;
alter table as_workspace add column if not exists webhook_id text;
alter table as_workspace add column if not exists bot_connected_at timestamptz;
alter table as_workspace add column if not exists public_origin text;
alter table as_workspace add column if not exists poll_mode boolean not null default false;
alter table as_workspace add column if not exists channel_username text;
alter table as_workspace add column if not exists pay_card text;
alter table as_workspace add column if not exists pay_bank text;
alter table as_workspace add column if not exists pay_holder text;
alter table as_workspace add column if not exists pay_amount integer not null default 0;

alter table as_clients add column if not exists paid boolean not null default false;
alter table as_clients add column if not exists paid_at timestamptz;

create table if not exists as_tg_sessions (
  user_id text not null,
  chat_id text not null,
  step text not null default 'category',
  draft text not null default '{}',
  live_order_id integer,
  last_status text,
  tg_name text,
  updated_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);

create table if not exists as_payments (
  id serial primary key,
  user_id text not null,
  client_id integer,
  telegram_id text,
  client_name text not null default '',
  amount integer not null default 0,
  screenshot text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists as_payments_user_idx on as_payments (user_id, created_at desc);
