-- Issue #103 — idempotencia de la creación de cotizaciones.
--
-- Un guard de UI no alcanza: otra pestaña no lo ve, y un guardado que expiró se
-- puede reintentar después. Cada intento lleva una clave generada por el
-- cliente; el índice único hace que el reintento sea un no-op en vez de una
-- segunda fila.
--
-- `client_id` es nullable para no romper las filas históricas: en Postgres los
-- NULL son distintos entre sí, así que un índice único no las hace colisionar.
-- La clave es un intento, no una huella de contenido: dos guardados
-- deliberados de la misma cotización siguen siendo dos filas.
alter table public.cotizaciones
  add column client_id uuid;

create unique index cotizaciones_owner_client_id_key
  on public.cotizaciones (owner_id, client_id)
  where client_id is not null;

comment on column public.cotizaciones.client_id is
  'Issue #103: idempotency key of one save attempt. NULL for rows created before this migration.';
