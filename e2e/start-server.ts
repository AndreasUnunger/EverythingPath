import { command, loadRun } from './support/process';

const run = await loadRun();
const environment = { ...process.env };
delete environment.CONVEX_DEPLOY_KEY;
// Match Next's localhost normalization for internal Clerk rewrites, while
// binding IPv4 loopback for the browser's 127.0.0.1 origin.
environment.NODE_OPTIONS = '--dns-result-order=ipv4first';
try {
  await command(
    'production application server',
    [
      'start',
      '--hostname',
      'localhost',
      '--port',
      new URL(run.baseURL).port,
    ],
    { cwd: run.workspace, env: environment, timeout: 900_000 },
  );
} catch {
  // Playwright normally terminates the server during teardown. The command
  // adapter has already retained any allowlisted application diagnostics.
  process.exitCode = 1;
}
