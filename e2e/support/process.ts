import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { deploymentFixtureSchema, resourceSchema } from '../fixtures/catalog';
import { safeDiagnostic } from './artifacts';

export const runSchema = z.object({
  resources: resourceSchema,
  workspace: z.string(),
  sourceRoot: z.string(),
  privateDirectory: z.string(),
  artifactDirectory: z.string(),
  envFile: z.string(),
  baseURL: z.string().regex(/^http:\/\/127\.0\.0\.1:[0-9]+$/),
  fixture: deploymentFixtureSchema.optional(),
});
export type Run = z.infer<typeof runSchema>;

export async function loadRun() {
  const path = process.env.E2E_RUN_FILE;
  if (!path)
    throw new Error(
      'Run E2E through pnpm test:e2e with an explicit resource declaration',
    );
  return runSchema.parse(JSON.parse(await readFile(path, 'utf8')));
}
export async function savePrivate(path: string, content: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, content, { mode: 0o600 });
}

// Never forward CLI output: deployment/auth failures can contain credentials,
// arguments and provider payloads. Keep only a stage name and an exit code.
export async function command(
  stage: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; timeout?: number },
) {
  const runFile = (options.env ?? process.env).E2E_RUN_FILE;
  const diagnostics = new Set<string>();
  const log = async (status: string) => {
    if (!runFile) return;
    const run = runSchema.parse(JSON.parse(await readFile(runFile, 'utf8')));
    await mkdir(run.artifactDirectory, { recursive: true });
    await appendFile(
      join(run.artifactDirectory, 'stages.log'),
      `${stage}: ${status}\n`,
    );
    if (status !== 'started' && diagnostics.size) {
      await appendFile(
        join(run.artifactDirectory, 'diagnostics.log'),
        [...diagnostics]
          .map((diagnostic) => `${stage}: ${diagnostic}\n`)
          .join(''),
      );
    }
  };
  await log('started');
  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn('pnpm', args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
      const terminate = () => {
        try {
          if (child.pid && process.platform !== 'win32')
            process.kill(-child.pid, 'SIGTERM');
          else child.kill('SIGTERM');
        } catch {
          /* The process may already have exited. */
        }
      };
      const timeout = setTimeout(terminate, options.timeout ?? 180_000);
      process.once('SIGINT', terminate);
      process.once('SIGTERM', terminate);
      let output = '';
      child.stdout.on('data', (chunk: Buffer) => {
        if (output.length < 4_000_000) output += chunk.toString();
      });
      for (const stream of [child.stdout, child.stderr]) {
        createInterface({ input: stream }).on('line', (line: string) => {
          const diagnostic = safeDiagnostic(line);
          if (diagnostic) diagnostics.add(diagnostic);
        });
      }
      child.on('error', () =>
        reject(new Error(`${stage}: process could not start`)),
      );
      child.on('close', (code) => {
        clearTimeout(timeout);
        process.removeListener('SIGINT', terminate);
        process.removeListener('SIGTERM', terminate);
        terminate();
        if (code === 0) resolve(output);
        else
          reject(
            new Error(`${stage}: process failed (${code ?? 'terminated'})`),
          );
      });
    });
    await log('passed');
    return output;
  } catch (error) {
    await log('failed');
    throw error;
  }
}

export async function fixtureCall(
  run: Run,
  operation:
    | 'seedIdentityProjection'
    | 'resetCase'
    | 'inspectCase'
    | 'cleanupCase',
  args: Record<string, unknown>,
): Promise<unknown> {
  const output = await command(
    `fixture ${operation}`,
    [
      'exec',
      'convex',
      'run',
      `e2eFixtures:${operation}`,
      JSON.stringify(args),
      '--preview-name',
      run.resources.previewName,
      '--env-file',
      run.envFile,
    ],
    { cwd: run.workspace },
  );
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new Error('Fixture operation returned an invalid response');
  }
}
