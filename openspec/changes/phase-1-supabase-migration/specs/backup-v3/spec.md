# backup-v3 Specification

## Purpose

Backup format v3: the export/import JSON now carries `listSends` alongside `products` and `quotes`, with a list-send content signature that makes import idempotent and multi-file-safe. v3 MUST ship before any real-data migration because v2 silently drops all list sends. Import is additive and update-only into the shared dataset; one user's import is visible to all five users. Drafts stay out of backups; the `BackupReminder` is retired.

## Requirements

### Requirement: Version-3 backup format and export

`BACKUP_VERSION` MUST be `3`. `BackupFile` MUST contain `version`, `exportedAt`, `products`, `quotes`, and `listSends`. Export MUST serialize all three collections from the active repositories in one file. This export MUST work against the pre-migration app (slice 1 lands on `master` first) so users can capture list-send history before the cutover deploy.

#### Scenario: v3 export round-trips all three collections

- GIVEN a dataset with 2 products, 1 quote, and 1 list send
- WHEN the user exports a backup and re-imports it into an empty dataset
- THEN products, quotes, and list sends MUST all be restored with items intact

#### Scenario: v3 export is available before migration code ships

- GIVEN the pre-migration local-first build with v3 merged
- WHEN the user opens the export menu item
- THEN the downloaded file MUST have `version` 3 and MUST include the `listSends` array

### Requirement: Backward-compatible import reading

The import reader MUST accept v1 (bare product array), v2 (`version: 2` with `products` + `quotes`), and v3 (`products` + `quotes` + `listSends`). A v1/v2 file without `listSends` MUST be treated as having zero list sends, never as an error.

#### Scenario: v2 file still imports after v3 ships

- GIVEN a v2 backup file with products and quotes but no `listSends`
- WHEN it is parsed and applied
- THEN all its products and quotes MUST import and zero list sends SHALL be added

#### Scenario: Malformed file reports errors without partial writes

- GIVEN a corrupt or schema-invalid file
- WHEN preview runs
- THEN the preview MUST list errors and applying it MUST NOT write any rows

### Requirement: Preview and result report list-send counts

`ImportPreview` MUST report `toAdd`, `toUpdate` (with target `id` and `input`), `quotesToAdd`, `listSendsToAdd`, and `errors`. `ImportResult` MUST report `success`, `updated`, `quotesAdded`, `listSendsAdded`, and `errors`. Preview MUST perform no writes. The import confirmation/summary copy MUST report list-send counts alongside product and quote counts (accepted copy delta).

#### Scenario: Dry run previews without writing

- GIVEN a file with 1 new product, 1 duplicate-name product, 1 new quote, and 1 new list send
- WHEN preview runs
- THEN it MUST report each bucket correctly and the database MUST be unchanged

#### Scenario: Confirmation copy shows list-send outcome

- GIVEN a completed import that added 2 list sends
- WHEN the summary renders
- THEN it MUST state the number of list sends added

### Requirement: Content signatures for idempotent merge

Quote merge MUST keep today's signature (`fecha` ISO + items + `total`; `cliente` stays out of the signature, preserving current behavior). List-send merge MUST use `listSendSignature(send)`: JSON of `{ fecha: ISO, cliente: trimmed + lowercased, items: [{ nombre, formato, precioNeto, precioBruto }] }`. Importing the same file twice, or importing two devices' files with overlapping history, MUST NOT duplicate quotes or list sends.

#### Scenario: Re-importing the same file adds nothing

- GIVEN a v3 file already imported once
- WHEN the identical file is imported again
- THEN zero quotes and zero list sends SHALL be added on the second run

#### Scenario: Same client with different casing merges

- GIVEN an existing list send for "Almacén Sur"
- WHEN a file containing the same send as "  almacén sur " with identical items and timestamp is imported
- THEN it MUST be recognized as a duplicate and SHALL NOT be inserted

#### Scenario: Genuinely different sends both import

- GIVEN an existing list send for a client on one date
- WHEN a file contains a send for the same client on a different date
- THEN the new send MUST be inserted

### Requirement: Additive import into shared state

Import MUST be additive and update-only: it MUST never delete rows. Products MUST match by exact `nombre` (update existing, insert new); the database unique index plus the `23505` mapping replaces `deduplicateProducts` and the old name pre-checks. Quotes and list sends MUST insert only when their content signature is unseen. Every imported row's `owner_id` MUST be the importing user's id (provenance, not access control). Incoming file ids MUST be ignored; the server assigns all ids. One user's import MUST be visible to all five users.

#### Scenario: Product import updates by name instead of duplicating

- GIVEN an existing product "Almendra" at price 1000 and a file with "Almendra" at price 1200
- WHEN the file is applied
- THEN the existing row MUST be updated to 1200 and no second "Almendra" row SHALL exist

#### Scenario: Stale file never deletes newer server rows

- GIVEN a server with 50 products and a month-old file with 30 products
- WHEN the file is applied
- THEN all 50 server products MUST still exist and the 20 missing from the file MUST NOT be removed

#### Scenario: Imported rows carry the importer's ownership

- GIVEN user B applies a backup originally exported by user A
- WHEN the import completes
- THEN every newly inserted row MUST have `owner_id` equal to user B's id

### Requirement: Drafts excluded and reminder retired

Drafts MUST remain excluded from every backup version by design. The `BackupReminder` component, its utility module, its tests, and its `markBackedUp()` call MUST be retired and removed; its claim about browser-cleared data loss becomes false once data is server-side. The manual Export menu item MUST stay as the recovery path until the project is on Pro.

#### Scenario: Backup contains no drafts

- GIVEN a saved quote draft plus saved quotes
- WHEN a backup is exported
- THEN the file MUST contain quotes and MUST NOT contain any draft payload

#### Scenario: No reminder surface remains

- GIVEN the cutover build
- WHEN the app renders through any flow
- THEN no backup-reminder banner, snooze state, or related copy SHALL appear, while the Export menu item MUST remain available

### Requirement: v3-gated single-canonical migration

Real-data migration MUST NOT run until v3 has shipped and a v3 backup has been taken immediately beforehand. The migration source MUST be a single canonical v3 file from one designated device (default: the admin's), executed by the admin through the app's existing Import UI after the Supabase build is deployed. Because the PWA auto-updates, all v3 exports MUST happen before the cutover deploy. Importing additional devices' v3 files afterwards MUST be safe (signature merge) and optional. Verification MUST confirm per-table row counts, populated `owner_id` on every row, cross-user visibility of an edit, and intact quote/list-send history (including a `ClientPrices` spot-check for two known clients).

#### Scenario: Migration is blocked while export is still v2

- GIVEN the app still exporting `BACKUP_VERSION = 2`
- WHEN migration readiness is assessed
- THEN migration MUST NOT proceed because list-send history would be lost

#### Scenario: Canonical import preserves full client price history

- GIVEN the canonical v3 file with products, quotes, and list sends
- WHEN the admin applies it on the fresh Supabase build
- THEN per-table counts MUST match the file's unseen-signature counts and no list send SHALL be missing

#### Scenario: Optional second device file merges without duplication

- GIVEN a migrated server plus a second device's v3 file overlapping in history
- WHEN the second file is applied
- THEN only genuinely unseen quotes and list sends SHALL be added
