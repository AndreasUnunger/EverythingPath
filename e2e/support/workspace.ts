import { execFileSync } from 'node:child_process';
import { copyFile, cp, mkdir, readdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
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
  await cp(join(sourceRoot, 'node_modules'), join(workspace, 'node_modules'), {
    recursive: true,
    verbatimSymlinks: true,
    mode: constants.COPYFILE_FICLONE,
  });
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
  const refuse = (file: string) => {
    throw new Error(
      `Convex generated-code drift (${file}); regenerate and review before E2E`,
    );
  };
  if (source.join('\n') !== generated.join('\n')) refuse('file list');
  for (const file of source)
    if (
      !(await readFile(join(sourceDirectory, file))).equals(
        await readFile(join(generatedDirectory, file)),
      )
    )
      refuse(file);
}
