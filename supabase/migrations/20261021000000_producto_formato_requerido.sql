-- Issue #94 — a product must carry a usable format.
--
-- An empty format was a legal stored value, and the quote maths turned it into
-- a line of 0 kg and $0 while the client document printed a real product name.
--
-- NOT VALID keeps historical rows with an empty format readable and leaves them
-- untouched; Postgres enforces the constraint for every new row and for any
-- update of an existing one, so a legacy product must be fixed the next time it
-- is edited. The application marks those legacy lines as invalid in the cart
-- and blocks saving or exporting a quote that contains one.
alter table public.productos
  add constraint productos_formato_requerido
  check (formato ~ '^\d+(,\d+)?$') not valid;

comment on constraint productos_formato_requerido on public.productos is
  'Issue #94: formato must be a Chilean number (e.g. 11,34). Added NOT VALID so legacy empty formats stay readable; they are enforced on the next update.';
