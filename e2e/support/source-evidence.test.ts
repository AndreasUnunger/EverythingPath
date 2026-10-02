// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { sourceFingerprint } from './source-evidence';

test('unstaged and staged deletions fingerprint the same working source', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-evidence-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    writeFileSync(join(root, 'app.ts'), 'export const value = 1;');
    writeFileSync(join(root, 'removed.ts'), 'export const unused = 2;');
    execFileSync('git', ['add', '.'], { cwd: root });
    const initial = sourceFingerprint(root);
    rmSync(join(root, 'removed.ts'));
    const deleted = sourceFingerprint(root);
    expect(deleted).not.toBe(initial);
    execFileSync('git', ['add', '-u'], { cwd: root });
    expect(sourceFingerprint(root)).toBe(deleted);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('evidence follows working source, new tests, rules and configuration while ignoring private credentials and reports', () => {
  const root = mkdtempSync(join(tmpdir(), 'source-evidence-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    writeFileSync(join(root, '.gitignore'), '.private/\n');
    mkdirSync(join(root, '.private'));
    mkdirSync(join(root, 'docs/ai/ironfang-militia'), { recursive: true });
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'app.ts'), 'export const value = 1;');
    execFileSync('git', ['add', '.'], { cwd: root });
    const initial = sourceFingerprint(root);
    writeFileSync(join(root, '.private/credentials.json'), '{"private":true}');
    writeFileSync(join(root, 'docs/review.md'), 'Human report');
    expect(sourceFingerprint(root)).toBe(initial);
    mkdirSync(join(root, '.claude'));
    symlinkSync('../.private', join(root, '.claude/skills'));
    writeFileSync(join(root, 'CLAUDE.md'), 'Agent-only guidance');
    expect(sourceFingerprint(root)).toBe(initial);
    for (const [file, content] of [
      ['app.ts', 'export const value = 2;'],
      ['new.test.ts', 'New test'],
      ['docs/ai/ironfang-militia/militia-rules.md', 'Changed rule'],
      ['tsconfig.json', '{}'],
      ['globals.css', 'body { display: none; }'],
      ['public/banner.svg', '<svg />'],
    ]) {
      const before = sourceFingerprint(root);
      writeFileSync(join(root, file!), content!);
      expect(sourceFingerprint(root)).not.toBe(before);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
