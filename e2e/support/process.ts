import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { deploymentFixtureSchema, resourceSchema } from '../fixtures/catalog';
import { safeDiagnostic } from './artifacts';

export const runSchema = z.object({
  mode: z.enum(['mandatory', 'nightly']).default('mandatory'),
  resources: resourceSchema,
  workspace: z.string(),
  sourceRoot: z.string(),
  privateDirectory: z.string(),
  artifactDirectory: z.string(),
  envFile: z.string(),
  baseURL: z.string().regex(/^http:\/\/(?:localhost|127\.0\.0\.1):[0-9]+$/),
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
  const environment = { ...(options.env ?? process.env) };
  if (environment.CONVEX_DEPLOY_KEY?.startsWith('preview:')) {
    // Convex otherwise prefers ~/.convex/config.json over preview deploy keys.
    // Pin the same declared key for both project selection and authentication.
    environment.CONVEX_OVERRIDE_ACCESS_TOKEN = environment.CONVEX_DEPLOY_KEY;
  }
  const runFile = environment.E2E_RUN_FILE;
  const diagnostics = new Set<string>();
  const diagnosticWrites: Promise<void>[] = [];
  const run = runFile
    ? runSchema.parse(JSON.parse(await readFile(runFile, 'utf8')))
    : null;
  let diagnosticWriteFailed = false;
  const log = async (status: string) => {
    if (!run) return;
    await mkdir(run.artifactDirectory, { recursive: true });
    await appendFile(
      join(run.artifactDirectory, 'stages.log'),
      `${stage}: ${status}\n`,
    );
  };
  await log('started');
  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn('pnpm', args, {
        cwd: options.cwd,
        env: environment,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
      let interrupted = false;
      let forceKill: ReturnType<typeof setTimeout> | undefined;
      const terminate = () => {
        interrupted = true;
        forceKill ??= setTimeout(() => {
          try {
            if (child.pid && process.platform !== 'win32')
              process.kill(-child.pid, 'SIGKILL');
            else child.kill('SIGKILL');
          } catch {
            /* The process has already exited. */
          }
        }, 5000);
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
          if (diagnostic && !diagnostics.has(diagnostic)) {
            diagnostics.add(diagnostic);
            if (run)
              diagnosticWrites.push(
                appendFile(
                  join(run.artifactDirectory, 'diagnostics.log'),
                  `${stage}: ${diagnostic}\n`,
                ).catch(() => {
                  diagnosticWriteFailed = true;
                }),
              );
          }
        });
      }
      child.on('error', () =>
        reject(new Error(`${stage}: process could not start`)),
      );
      child.on('close', (code) => {
        clearTimeout(timeout);
        process.removeListener('SIGINT', terminate);
        process.removeListener('SIGTERM', terminate);
        const wasInterrupted = interrupted;
        terminate();
        clearTimeout(forceKill);
        if (code === 0 && !wasInterrupted) resolve(output);
        else
          reject(
            new Error(`${stage}: process failed (${code ?? 'terminated'})`),
          );
      });
    });
    await Promise.all(diagnosticWrites);
    if (diagnosticWriteFailed)
      throw new Error('E2E diagnostic log could not be saved');
    await log('passed');
    return output;
  } catch (error) {
    await Promise.all(diagnosticWrites);
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
  return parseFixtureResponse(operation, output);
}

export async function canonicalPersistenceFixtureCall(
  run: Run,
  operation: 'initialize' | 'close',
  args: Record<string, unknown>,
): Promise<unknown> {
  const output = await command(
    `canonical persistence fixture ${operation}`,
    [
      'exec',
      'convex',
      'run',
      `canonicalPersistenceFixtures:${operation}`,
      JSON.stringify(args),
      '--preview-name',
      run.resources.previewName,
      '--env-file',
      run.envFile,
    ],
    { cwd: run.workspace },
  );
  if (operation === 'close' && !output.trim()) return null;
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new Error(
      'Canonical persistence fixture returned an invalid response',
    );
  }
}

export function parseFixtureResponse(
  operation:
    | 'seedIdentityProjection'
    | 'resetCase'
    | 'inspectCase'
    | 'cleanupCase',
  output: string,
): unknown {
  // Convex CLI omits output for null returns from these two mutations.
  if (
    !output.trim() &&
    (operation === 'seedIdentityProjection' || operation === 'cleanupCase')
  )
    return null;
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new Error('Fixture operation returned an invalid response');
  }
}
