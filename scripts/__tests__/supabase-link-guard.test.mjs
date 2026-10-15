import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

import { checkSupabaseLink } from '../supabase-link-guard.mjs';

// Vitest runs with the repository as its root, and its transform rewrites
// import.meta.url, so paths are resolved from the working directory.
const ROOT = process.cwd();
const GUARD = resolve(ROOT, 'scripts/supabase-link-guard.mjs');
const run = promisify(execFile);

// Read the expected ref from the same versioned source the guard uses, so this
// suite does not hardcode a second copy that could silently disagree.
const REFS = JSON.parse(await readFile(resolve(ROOT, 'supabase/project-refs.json'), 'utf8'));
const EXPECTED = {
  expectedRef: REFS.production.ref,
  expectedName: REFS.production.name,
};

// The project this machine was once silently linked to instead of production.
const OTHER_REF = 'ptsvftbnfmflgcgmmymr';

async function linkedFileWith(contents) {
  const dir = await mkdtemp(join(tmpdir(), 'supabase-link-guard-'));
  const file = join(dir, 'project-ref');
  await writeFile(file, contents);
  return file;
}

describe('checkSupabaseLink', () => {
  it('accepts the linked ref that matches production', () => {
    const verdict = checkSupabaseLink({ ...EXPECTED, linkedRef: EXPECTED.expectedRef });
    expect(verdict.ok).toBe(true);
    expect(verdict.reason).toBe('match');
  });

  it('rejects another project, naming both refs and the link command that fixes it', () => {
    const verdict = checkSupabaseLink({ ...EXPECTED, linkedRef: OTHER_REF });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('mismatch');
    expect(verdict.message).toContain(OTHER_REF);
    expect(verdict.message).toContain(EXPECTED.expectedRef);
    expect(verdict.message).toContain(`supabase link --project-ref ${EXPECTED.expectedRef}`);
  });

  it('treats an empty link as unlinked rather than as a match', () => {
    const verdict = checkSupabaseLink({ ...EXPECTED, linkedRef: '' });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('not-linked');
  });

  it('treats a missing link as unlinked rather than as a match', () => {
    expect(checkSupabaseLink({ ...EXPECTED, linkedRef: null }).reason).toBe('not-linked');
    expect(checkSupabaseLink({ ...EXPECTED, linkedRef: undefined }).reason).toBe('not-linked');
  });

  it('ignores surrounding whitespace around the linked ref', () => {
    const verdict = checkSupabaseLink({
      ...EXPECTED,
      linkedRef: `  ${EXPECTED.expectedRef}\n`,
    });
    expect(verdict.ok).toBe(true);
  });

  it('rejects a near-miss ref, which is the exact failure this guard exists for', () => {
    // A ref that differs by one character, and the corrupted ref that was
    // published in issue #73 (two characters longer than the real one).
    expect(checkSupabaseLink({ ...EXPECTED, linkedRef: 'gwajtwzdomccuptizbo' }).ok).toBe(false);
    expect(checkSupabaseLink({ ...EXPECTED, linkedRef: 'gwajtwzdcommccuptizboj' }).ok).toBe(false);
  });
});

describe('supabase-link-guard CLI', () => {
  it('exits 0 when the linked ref matches production', async () => {
    const file = await linkedFileWith(EXPECTED.expectedRef);
    const { stdout } = await run(process.execPath, [GUARD, '--linked-file', file]);
    expect(stdout).toContain(EXPECTED.expectedRef);
  });

  it('exits 1 and prints the fix when the linked ref is another project', async () => {
    const file = await linkedFileWith(OTHER_REF);
    const result = await run(process.execPath, [GUARD, '--linked-file', file]).catch((e) => e);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(OTHER_REF);
    expect(result.stderr).toContain(`supabase link --project-ref ${EXPECTED.expectedRef}`);
  });

  it('exits 1 when nothing is linked', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'supabase-link-guard-')), 'missing');
    const result = await run(process.execPath, [GUARD, '--linked-file', file]).catch((e) => e);
    expect(result.code).toBe(1);
  });

  it('fails closed with exit 2 on an unknown argument instead of pushing blindly', async () => {
    const result = await run(process.execPath, [GUARD, '--nope']).catch((e) => e);
    expect(result.code).toBe(2);
  });
});

it('the package db:push script runs the guard before supabase db push', async () => {
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'));
  expect(manifest.scripts?.['db:push']).toBe(
    'node scripts/supabase-link-guard.mjs && supabase db push',
  );
});
