#!/usr/bin/env node
// Refuses to push migrations while the Supabase CLI is linked to a project
// other than production.
//
// The link lives only in supabase/.temp/, which supabase/.gitignore excludes,
// so nothing versioned kept it honest and it silently drifted to a paused
// project once already (issue #73). A `supabase db push` from that state would
// have written this repository's migrations to the wrong project. The expected
// ref is recorded in supabase/project-refs.json so it travels with the repo.
//
// Usage:
//   node scripts/supabase-link-guard.mjs [--linked-file <path>]
//
// Exit codes: 0 the link matches production, 1 it does not (or nothing is
// linked), 2 a usage or configuration error. `pnpm db:push` chains this before
// `supabase db push`, so a mismatch stops the push instead of misdirecting it.

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REFS_FILE = resolve(ROOT, 'supabase/project-refs.json');
const DEFAULT_LINKED_FILE = resolve(ROOT, 'supabase/.temp/project-ref');

const USAGE = 'Usage: node scripts/supabase-link-guard.mjs [--linked-file <path>]';

/**
 * Decide whether the linked ref is the expected one.
 *
 * Pure on purpose: both refs arrive as arguments and no file is read, so the
 * rule can be exercised directly instead of through the filesystem.
 */
export function checkSupabaseLink({ expectedRef, expectedName, linkedRef }) {
  const linked = typeof linkedRef === 'string' ? linkedRef.trim() : '';
  const fix = `supabase link --project-ref ${expectedRef}`;

  if (linked === '') {
    return {
      ok: false,
      reason: 'not-linked',
      message: [
        'No Supabase project is linked, so a push cannot be trusted.',
        '',
        `Link it to ${expectedName} first:`,
        `  ${fix}`,
      ].join('\n'),
    };
  }

  if (linked !== expectedRef) {
    return {
      ok: false,
      reason: 'mismatch',
      message: [
        'The Supabase CLI is linked to the WRONG project.',
        '',
        `  expected (${expectedName}): ${expectedRef}`,
        `  linked now: ${linked}`,
        '',
        'A push from here would apply migrations to the wrong project.',
        '',
        'Fix the link:',
        `  ${fix}`,
      ].join('\n'),
    };
  }

  return {
    ok: true,
    reason: 'match',
    message: `Supabase CLI is linked to ${expectedName} (${expectedRef}).`,
  };
}

function parseArgs(argv) {
  const options = { linkedFile: DEFAULT_LINKED_FILE, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--linked-file') {
      const value = argv[i + 1];
      if (value === undefined || value === '') {
        throw new Error('--linked-file needs a path');
      }
      options.linkedFile = isAbsolute(value) ? value : resolve(process.cwd(), value);
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  return options;
}

function readProductionRef() {
  const refs = JSON.parse(readFileSync(REFS_FILE, 'utf8'));
  const production = refs?.production;

  if (typeof production?.ref !== 'string' || production.ref === '') {
    throw new Error(`${REFS_FILE} does not define production.ref`);
  }

  return production;
}

function readLinkedRef(linkedFile) {
  try {
    return readFileSync(linkedFile, 'utf8');
  } catch {
    // Missing or unreadable counts as "not linked", so the guard fails closed
    // rather than assuming an unverifiable push is safe.
    return '';
  }
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    return 2;
  }

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  let production;
  try {
    production = readProductionRef();
  } catch (error) {
    console.error(`Cannot read the expected production ref: ${error.message}`);
    return 2;
  }

  const verdict = checkSupabaseLink({
    expectedRef: production.ref,
    expectedName: production.name,
    linkedRef: readLinkedRef(options.linkedFile),
  });

  if (verdict.ok) {
    console.log(verdict.message);
    return 0;
  }

  console.error(verdict.message);
  console.error(`\n(checked ${options.linkedFile})`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
