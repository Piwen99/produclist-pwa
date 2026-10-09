# supabase-schema Specification

## Purpose

Server-side Postgres schema for Phase 1: the shared catalog (`productos`), quote history (`cotizaciones`), list-send history (`listas_enviadas`), and user profiles (`perfiles`). This spec defines tables, identity strategy, ownership provenance, and the shared-visibility access policy. All five authenticated users read and write all rows; per-vendor scoping is explicitly out of scope.

## Requirements

### Requirement: Product catalog table

The system MUST provide a `productos` table that stores the shared product catalog with numeric identity keys, a unique product name, and domain checks that replace the former application-level `deduplicateProducts` logic.

Columns: `id bigint generated always as identity primary key`, `nombre text NOT NULL`, `categoria text NOT NULL`, `formato text NOT NULL DEFAULT ''`, `precio_neto integer NOT NULL`, `disponible boolean NOT NULL DEFAULT true`, `owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id)`, `created_at timestamptz NOT NULL DEFAULT now()`. Constraints: unique index on `nombre`; `categoria` limited to `Frutos Secos`, `Semillas/Cereal`, `Fruta Deshidratada`, `Legumbres`; `formato` is empty or matches the numeric weight pattern; `precio_neto >= 0`.

#### Scenario: Catalog row round-trips with domain types

- GIVEN an authenticated session
- WHEN a product named "Nuez Mariposa" in category "Frutos Secos" is inserted
- THEN exactly one row exists with a server-assigned numeric `id`, `precio_neto` equal to the input price, and `created_at` populated

#### Scenario: Duplicate product name is rejected by the database

- GIVEN a product named "Almendra" already exists
- WHEN a second insert with `nombre` "Almendra" is attempted
- THEN the insert MUST fail with a uniqueness violation on `productos.nombre`

#### Scenario: Invalid category or negative price is rejected

- GIVEN an authenticated session
- WHEN an insert uses a `categoria` outside the allowed set or a negative `precio_neto`
- THEN the insert MUST fail with a check-constraint violation

### Requirement: Quote history table with jsonb items

The system MUST provide a `cotizaciones` table that stores saved quotes with embedded `jsonb` item snapshots. The system MUST NOT use a normalized child item table in Phase 1.

Columns: `id bigint generated always as identity primary key`, `fecha timestamptz NOT NULL DEFAULT now()`, `cliente text` (nullable), `items jsonb NOT NULL DEFAULT '[]'::jsonb`, `total_neto integer NOT NULL`, `iva integer NOT NULL`, `total integer NOT NULL`, `owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id)`, `created_at timestamptz NOT NULL DEFAULT now()`, plus a descending index on `fecha`.

#### Scenario: Saved quote preserves its item snapshot verbatim

- GIVEN an authenticated session
- WHEN a quote with two line items is saved
- THEN one `cotizaciones` row exists whose `items` JSON equals the submitted `QuoteItem[]` shape and whose totals match the submission

#### Scenario: Quote without a client name is accepted

- GIVEN an authenticated session
- WHEN a quote with `cliente` null is saved
- THEN the insert MUST succeed and the row MUST be listable in history

### Requirement: List-send history table with jsonb items

The system MUST provide a `listas_enviadas` table that stores price-list sends with embedded `jsonb` item snapshots. The system MUST NOT use a normalized child item table in Phase 1.

Columns: `id bigint generated always as identity primary key`, `fecha timestamptz NOT NULL DEFAULT now()`, `cliente text NOT NULL`, `items jsonb NOT NULL DEFAULT '[]'::jsonb`, `owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id)`, `created_at timestamptz NOT NULL DEFAULT now()`, plus a descending index on `fecha`.

#### Scenario: List send round-trips with items intact

- GIVEN an authenticated session
- WHEN a list send for client "Almacén Sur" with three items is saved
- THEN one `listas_enviadas` row exists whose `items` JSON equals the submitted `ListSendItem[]` shape

#### Scenario: List send without a client name is rejected

- GIVEN an authenticated session
- WHEN a list send with an empty or missing `cliente` is inserted
- THEN the insert MUST fail with a not-null violation

### Requirement: Profiles table and provisioning trigger

The system MUST provide a `perfiles` table keyed by the auth user id, populated automatically when an auth user is created. The table MUST have columns `id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE`, `email text NOT NULL UNIQUE`, `nombre text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`. A trigger on `auth.users` insert MUST insert the profile row using `raw_user_meta_data ->> 'nombre'` with an email-prefix fallback. The system MUST NOT carry a separate `owner_id` column on `perfiles` because `id` already identifies the owner.

#### Scenario: New auth user gains a profile row automatically

- GIVEN the trigger is installed
- WHEN a new auth user with email `vendedor1@example.com` is created
- THEN exactly one `perfiles` row exists with that email and a non-empty `nombre`

#### Scenario: Profile follows auth user deletion

- GIVEN an existing user and profile
- WHEN the auth user is deleted
- THEN the corresponding `perfiles` row MUST be removed by cascade

### Requirement: Ownership provenance and shared-visibility access policy

The system MUST record `owner_id` as provenance on every row of `productos`, `cotizaciones`, and `listas_enviadas`, and MUST enforce shared visibility: every authenticated user can read and write every row. `owner_id` is provenance only and MUST NOT act as an access boundary in Phase 1.

Concretely: Row Level Security MUST be enabled on all four tables. The data tables MUST expose one permissive policy for the `authenticated` role (`FOR ALL USING (true) WITH CHECK (true)`); `perfiles` MUST allow `SELECT` to `authenticated`. Grants MUST give `authenticated` full DML on the three data tables and `SELECT` on `perfiles`. The `anon` role MUST have no policies and therefore no access. Every `owner_id` column MUST be `NOT NULL DEFAULT auth.uid()` so a forgotten explicit value cannot create an ownerless row when inserting with a user JWT.

#### Scenario: Authenticated user sees rows created by another user

- GIVEN a product row created by user A
- WHEN user B signs in and lists products
- THEN user B MUST see user A's row

#### Scenario: Authenticated user can edit another user's row

- GIVEN a product row owned by user A
- WHEN user B updates its price
- THEN the update MUST succeed and remain visible to all users

#### Scenario: Unauthenticated access is denied

- GIVEN no valid session
- WHEN any read or write against the data tables is attempted
- THEN access MUST be denied

#### Scenario: First insert always carries an owner

- GIVEN an authenticated session inserting a product without an explicit `owner_id`
- WHEN the insert executes with the user's JWT
- THEN the stored row MUST have `owner_id` equal to that user's id and MUST NOT be null

### Requirement: Numeric identity keys assigned by the server

The system MUST use `bigint generated always as identity` primary keys on all three data tables, and domain types MUST keep numeric ids (`Product.id?: number`, `QuoteItem.productId: number`). Import and migration paths MUST never trust file-supplied ids; the server MUST assign every id. `QuoteItem.productId` MUST be treated as historical snapshot metadata written at add time and never resolved against `productos.id` for lookups.

#### Scenario: Server assigns ids on insert

- GIVEN a product payload without an `id`
- WHEN it is inserted
- THEN the returned row MUST carry a positive numeric `id` assigned by the database

#### Scenario: Stale file product ids do not collide with server ids

- GIVEN a backup file containing products with old local ids
- WHEN the file is imported
- THEN imported products MUST receive fresh server-assigned ids and no id from the file SHALL be reused as a primary key

### Requirement: App-driven catalog seeding

The system MUST seed the shared 44-product catalog from the application on first authenticated load when the `productos` table is empty, using an upsert on `nombre` that ignores duplicates so concurrent first-logins and StrictMode double-mounts cannot create duplicates. Seed rows take the `owner_id` of the first authenticated seeder (normally the admin); this value is provenance, not access control. The system MUST NOT seed via a SQL migration with duplicated product data.

#### Scenario: Empty catalog is seeded once on first login

- GIVEN an empty `productos` table and an authenticated user
- WHEN the first authenticated load runs
- THEN the table MUST contain the 44 canonical products

#### Scenario: Concurrent seeding does not duplicate the catalog

- GIVEN an empty `productos` table
- WHEN two authenticated sessions trigger seeding concurrently
- THEN the table MUST still contain exactly one row per canonical product name
