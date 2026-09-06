-- wipe anonymized and demo seed clients so they never reappear in admin
delete from as_order_events where order_id in (
  select o.id from as_orders o join as_clients c on c.id = o.client_id
  where c.name = 'Удалён' or c.telegram_id is null or length(c.telegram_id) < 8
);
delete from as_notifications where order_id in (
  select o.id from as_orders o join as_clients c on c.id = o.client_id
  where c.name = 'Удалён' or c.telegram_id is null or length(c.telegram_id) < 8
);
delete from as_reviews where client_id in (
  select id from as_clients where name = 'Удалён' or telegram_id is null or length(telegram_id) < 8
);
delete from as_payments where client_id in (
  select id from as_clients where name = 'Удалён' or telegram_id is null or length(telegram_id) < 8
);
delete from as_orders where client_id in (
  select id from as_clients where name = 'Удалён' or telegram_id is null or length(telegram_id) < 8
);
delete from as_clients where name = 'Удалён' or telegram_id is null or length(telegram_id) < 8;
