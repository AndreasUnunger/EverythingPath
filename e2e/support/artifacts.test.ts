// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { safeDiagnostic, sanitizeLog, sanitizeTrace } from './artifacts';

describe('retained E2E evidence', () => {
  it('retains allowlisted service diagnostics without provider payloads', () => {
    expect(safeDiagnostic('ArgumentValidationError: token=opaque-secret')).toBe(
      'Convex argument validation failed',
    );
    expect(safeDiagnostic('Error: private unknown payload')).toBe(
      'application or service reported an error',
    );
    expect(safeDiagnostic('Cookie: opaque-session-value')).toBeNull();
    expect(safeDiagnostic('  "campaignId": "jwtc2k9r3xjwks4n8"')).toBeNull();
    expect(safeDiagnostic('Failed to verify JWT: bad issuer')).toBe(
      'authentication token or issuer failure',
    );
    expect(safeDiagnostic('fetch failed: sk_test_secret')).toBe(
      'service connection failed',
    );
  });
  it('removes service keys, JWTs, cookies and known opaque secrets', () => {
    const result = sanitizeLog(
      'sk_test_secret preview:team:project|secret eyJabc.def.ghi\nCookie: session=secret\nticket: secret\nopaque-capability',
      ['opaque-capability'],
    );
    expect(result).not.toContain('secret');
    expect(result).not.toContain('opaque-capability');
    expect(result).not.toContain('eyJ');
  });
  it('keeps trace actions and screenshots without auth, network, sources or evaluated values', () => {
    const archive = zipSync({
      'trace.trace': strToU8(
        [
          {
            type: 'context-options',
            version: 8,
            browserName: 'chromium',
            options: {
              storageState: { cookies: [{ value: 'COOKIE_SECRET' }] },
            },
          },
          {
            type: 'before',
            callId: 'call@1',
            method: 'evaluate',
            params: { expression: 'AUTH_EXPRESSION', arg: 'JWT_SECRET' },
          },
          {
            type: 'after',
            callId: 'call@1',
            error: { message: 'BACKEND_SECRET' },
            result: 'SECRET_RESULT',
          },
          { type: 'console', text: 'SECRET_LOG' },
          {
            type: 'screencast-frame',
            pageId: 'page@1',
            sha1: 'frame.jpeg',
            timestamp: 1,
            width: 1194,
            height: 834,
          },
        ]
          .map((entry) => JSON.stringify(entry))
          .join('\n'),
      ),
      'trace.network': strToU8('Authorization: SECRET'),
      'resources/source.txt': strToU8('SOURCE_SECRET'),
      'resources/frame.jpeg': new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    });
    const retained = unzipSync(sanitizeTrace(archive));
    expect(Object.keys(retained).sort()).toEqual([
      'resources/frame.jpeg',
      'trace.trace',
    ]);
    const timeline = strFromU8(retained['trace.trace']!);
    expect(timeline).not.toMatch(/SECRET|AUTH_EXPRESSION|storageState/);
    expect(timeline).toContain('call@1');
    expect(timeline).toContain('screencast-frame');
  });
});
