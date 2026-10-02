import { z } from 'zod';
import type { Repository } from './inventory.ts';
import { readObject, readText } from './values.ts';

export const upstreamRecord = z.object({
  _id: z.string().regex(/^[A-Za-z0-9]+$/),
  _key: z.string(),
  name: z.string(),
  type: z.string().default(''),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  folder: z.string().nullable().optional(),
  system: z.record(z.string(), z.unknown()).default({}),
});
export type SourceRecord = z.infer<typeof upstreamRecord>;
export type LoadedRecord = {
  repo: Repository;
  pack: string;
  path: string;
  record: SourceRecord;
};
export function toExternalKey({
  repo,
  record,
}: {
  repo: Repository;
  record: Pick<SourceRecord, '_id'>;
}): string {
  return `${repo}/${record._id}`;
}
export type Unsupported = { field: string; reason: string; value?: unknown };
export function sourceDescription(record: SourceRecord): string {
  const description = readObject(record.system.description);
  return (
    readText({ value: description.value }) ||
    readText({ value: description.unidentified }) ||
    readText({
      value: readObject(readObject(record.system.details).biography).value,
    }) ||
    readText({ value: readObject(record.system.details).biography })
  );
}
export function uuidKey(uuid: string): string | undefined {
  const match =
    /^Compendium\.(pf1|pf-content|pf1-content)\.[^.]+\.(?:Item\.|Actor\.)?([A-Za-z0-9]+)$/.exec(
      uuid,
    );
  return match
    ? toExternalKey({
        repo: match[1] === 'pf1' ? 'pf1' : 'pf1-content',
        record: { _id: match[2] ?? '' },
      })
    : undefined;
}
