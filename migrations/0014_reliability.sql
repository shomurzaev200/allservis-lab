alter table as_clients add column if not exists is_demo boolean not null default false;
alter table as_clients add column if not exists archived_at timestamptz;
alter table as_masters add column if not exists is_demo boolean not null default false;
alter table as_masters add column if not exists approved boolean not null default true;
alter table as_masters add column if not exists access_code text;
alter table as_masters add column if not exists specs text not null default '';

alter table as_orders add column if not exists cancel_reason text not null default '';
alter table as_orders add column if not exists scheduled_for timestamptz;
alter table as_orders add column if not exists price_estimate integer;
alter table as_orders add column if not exists price_agreed integer;
alter table as_orders add column if not exists price_paid integer not null default 0;
alter table as_orders add column if not exists client_confirmed boolean not null default false;
alter table as_orders add column if not exists operator_note text not null default '';
alter table as_orders add column if not exists assigned_by text;

alter table as_audit add column if not exists actor_name text;
alter table as_audit add column if not exists actor_email text;

update as_orders set price_estimate = price where price_estimate is null;
update as_masters set access_code = substr(md5(user_id || ':' || id::text), 1, 8) where access_code is null or access_code = '';
alter table as_masters add column if not exists zone text not null default '';
alter table as_masters add column if not exists schedule text not null default '';


create table if not exists as_payouts (
  id serial primary key,
  user_id text not null,
  master_id integer not null,
  order_id integer,
  amount integer not null,
  status text not null default 'accrued',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists as_payouts_master_idx on as_payouts (user_id, master_id, created_at desc);

create table if not exists as_tg_inbox (
  user_id text not null,
  bot_key text not null,
  update_id bigint not null,
  ok boolean not null default false,
  error text,
  created_at timestamptz not null default now(),
  primary key (user_id, bot_key, update_id)
);

with ranked as (
  select id, row_number() over (partition by user_id, public_no order by id) as rn
  from as_orders
)
update as_orders o
set public_no = public_no + 100000 + ranked.rn
from ranked
where o.id = ranked.id and ranked.rn > 1;

create unique index if not exists as_orders_public_uidx on as_orders (user_id, public_no);

delete from as_reviews a
using as_reviews b
where a.user_id = b.user_id and a.order_id = b.order_id and a.id > b.id;

create unique index if not exists as_reviews_order_uidx on as_reviews (user_id, order_id);
