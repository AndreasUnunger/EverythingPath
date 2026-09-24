import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Hash runtime, tests, configuration, lockfile and normative rules/decisions.
// Human-readable reports can be recorded afterward without changing test inputs.
export function sourceFingerprint(root: string) {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
    .split('\0')
    .filter(
      (file) =>
        file &&
        !file.startsWith('.agents/') &&
        !file.startsWith('.claude/') &&
        file !== 'CLAUDE.md' &&
        !file.startsWith('agent/') &&
        (!file.startsWith('docs/') ||
          file.startsWith('docs/ai/ironfang-militia/')),
    );
  const hash = createHash('sha256');
  for (const file of [...new Set(files)].sort()) {
    const content = readFileSync(join(root, file));
    hash.update(`${file}\0${content.length}\0`);
    hash.update(content);
  }
  return hash.digest('hex');
}
