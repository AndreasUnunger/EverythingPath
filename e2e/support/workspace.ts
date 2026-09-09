import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, symlink, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function copyBuildWorkspace(
  sourceRoot: string,
  workspace: string,
) {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: sourceRoot, encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean);
  for (const file of new Set(files)) {
    if (
      file.split('/').some((part) => part.startsWith('.')) ||
      file.startsWith('agent/') ||
      file.startsWith('node_modules/')
    )
      continue;
    const destination = join(workspace, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(sourceRoot, file), destination);
  }
  await symlink(
    join(sourceRoot, 'node_modules'),
    join(workspace, 'node_modules'),
    'dir',
  );
}

export async function checkGeneratedBindings(
  sourceRoot: string,
  workspace: string,
) {
  const sourceDirectory = join(sourceRoot, 'convex/_generated');
  const generatedDirectory = join(workspace, 'convex/_generated');
  const bindings = (files: string[]) =>
    files.filter((file) => /\.(?:ts|js)$/.test(file)).sort();
  const source = bindings(await readdir(sourceDirectory));
  const generated = bindings(await readdir(generatedDirectory));
  const refuse = () => {
    throw new Error(
      'Convex generated-code drift; regenerate and review before E2E',
    );
  };
  if (source.join('\n') !== generated.join('\n')) refuse();
  for (const file of source)
    if (
      !(await readFile(join(sourceDirectory, file))).equals(
        await readFile(join(generatedDirectory, file)),
      )
    )
      refuse();
}
