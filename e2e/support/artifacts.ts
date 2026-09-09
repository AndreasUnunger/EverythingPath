import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

export function sanitizeLog(value: string, secrets: string[] = []) {
  let safe = value;
  for (const secret of secrets
    .filter(Boolean)
    .sort((a, b) => b.length - a.length))
    safe = safe.split(secret).join('[redacted]');
  return safe
    .replace(/(?:sk|pk)_(?:test|live)_[A-Za-z0-9+/=_-]+/g, '[redacted-key]')
    .replace(
      /(?:preview|prod|dev|project):[^\s"']+\|[^\s"']+/g,
      '[redacted-key]',
    )
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[redacted-jwt]',
    )
    .replace(
      /((?:authorization|cookie|set-cookie|__session|ticket|token|password)\s*[=:]\s*)[^\r\n]+/gi,
      '$1[redacted]',
    );
}

type JsonObject = Record<string, unknown>;
function object(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Retain an action timeline and screencast only. Network bodies, headers,
// storage, snapshots, sources, evaluations and console payloads are discarded.
export function sanitizeTrace(bytes: Uint8Array) {
  const entries = unzipSync(bytes);
  const safe: Record<string, Uint8Array> = {};
  const frames = new Set<string>();
  for (const [name, entry] of Object.entries(entries)) {
    if (!/^[a-zA-Z0-9-]+\.trace$/.test(name)) continue;
    const events: JsonObject[] = [];
    for (const line of strFromU8(entry).split('\n').filter(Boolean)) {
      const value: unknown = JSON.parse(line);
      if (!object(value)) continue;
      const keep: JsonObject = {};
      if (value.type === 'context-options') {
        for (const key of [
          'version',
          'type',
          'browserName',
          'platform',
          'wallTime',
          'monotonicTime',
          'sdkLanguage',
          'contextId',
        ])
          keep[key] = value[key];
        keep.options = { viewport: { width: 1194, height: 834 } };
      } else if (value.type === 'before' || value.type === 'after') {
        for (const key of [
          'type',
          'callId',
          'startTime',
          'endTime',
          'class',
          'method',
          'apiName',
          'pageId',
          'parentId',
        ])
          if (typeof value[key] === 'string' || typeof value[key] === 'number')
            keep[key] = value[key];
        keep.params = {};
        if (value.error)
          keep.error = {
            name: 'Error',
            message:
              'Action failed; inspect the safe screenshot and domain assertion report.',
          };
      } else if (
        value.type === 'screencast-frame' &&
        typeof value.sha1 === 'string' &&
        /^[a-zA-Z0-9.-]+$/.test(value.sha1)
      ) {
        for (const key of [
          'type',
          'pageId',
          'sha1',
          'width',
          'height',
          'timestamp',
          'frameSwapWallTime',
        ])
          keep[key] = value[key];
        frames.add(`resources/${value.sha1}`);
      } else continue;
      events.push(keep);
    }
    safe[name] = strToU8(
      events.map((event) => JSON.stringify(event)).join('\n'),
    );
  }
  for (const name of frames) {
    const data = entries[name];
    if (
      data &&
      ((data[0] === 0xff && data[1] === 0xd8) ||
        (data[0] === 0x89 && data[1] === 0x50))
    )
      safe[name] = data;
  }
  return zipSync(safe);
}
