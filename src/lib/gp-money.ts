// Gold is shown and entered in gp; copper is what is stored (1 gp = 100 cp).
// Parsing works on the digits, never through floating point, so every stored
// copper amount survives a round trip exactly.
export type GpInput =
  | { kind: 'valid'; copper: number }
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string };

export function parseGpInput(text: string): GpInput {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' };
  const match = /^(\d+)(?:\.(\d*))?$/.exec(trimmed);
  if (!match)
    return {
      kind: 'invalid',
      message: 'Enter an amount in gp, such as 12 or 0.07.',
    };
  const [, whole = '', fraction = ''] = match;
  if (fraction.length > 2)
    return {
      kind: 'invalid',
      message: 'Use at most two decimal places (1 cp = 0.01 gp).',
    };
  const copper = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(copper))
    return { kind: 'invalid', message: 'Enter a smaller amount.' };
  return { kind: 'valid', copper };
}

export function copperToGpInput(copper: number): string {
  const whole = Math.floor(copper / 100);
  const fraction = String(copper % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}
