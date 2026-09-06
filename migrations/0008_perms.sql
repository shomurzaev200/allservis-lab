alter table as_staff alter column can_delete set default false;
alter table as_staff alter column can_assign set default false;
alter table as_staff alter column can_invite set default false;
alter table as_staff alter column can_finance set default false;
alter table as_staff alter column can_bots set default false;

-- Старые значения true стояли по умолчанию, а не потому что владелец их выдал.
-- Сбрасываем у всех, кроме владельца. Права нужно отметить заново в «Команда».
update as_staff set
  can_delete = false,
  can_assign = false
where role <> 'owner';
