import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { EVENT_TYPES } from './militia-domain';
import { militiaEventTable } from './militia-event-table';
import { EVENT_RULES_TEXT } from './event-rules-text';

// The catalogue is the rules corpus's `## Event:` sections, verbatim: each
// bullet in order, with its `Twice:` bullet held apart.
function corpusEvents() {
  const corpus = readFileSync(
    join(process.cwd(), 'docs/ai/ironfang-militia/militia-rules.md'),
    'utf8',
  );
  return corpus
    .split(/^## /m)
    .filter((section) => section.startsWith('Event: '))
    .map((section) => {
      const [heading, ...body] = section.trim().split('\n');
      const name = heading!
        .slice('Event: '.length)
        .replace(/ \(Persistent-capable\)$/, '');
      const bullets = body
        .filter((line) => line.startsWith('- '))
        .map((line) => line.slice(2));
      const twice = bullets.find((line) => line.startsWith('Twice: '));
      return {
        name,
        text: bullets.filter((line) => line !== twice),
        twice: twice ? twice.slice('Twice: '.length) : null,
      };
    });
}

test('[EVT-rules.catalogue] every engine event type has rules text taken verbatim from the corpus', () => {
  const corpus = corpusEvents();
  const byName = new Map(
    militiaEventTable.map((entry) => [entry.name.toLowerCase(), entry]),
  );
  // Table names differ only in capitalization ("Missing In Action").
  const names = (values: string[]) =>
    values.map((value) => value.toLowerCase()).sort();
  expect(names(corpus.map((entry) => entry.name))).toEqual(
    names(militiaEventTable.map((entry) => entry.name)),
  );
  for (const entry of corpus) {
    const type = byName.get(entry.name.toLowerCase())!.eventType;
    expect(EVENT_RULES_TEXT[type], entry.name).toEqual({
      text: entry.text,
      twice: entry.twice,
    });
  }
  expect(Object.keys(EVENT_RULES_TEXT).sort()).toEqual([...EVENT_TYPES].sort());
});
