import { expect, test } from 'vitest';
import { copperToGpInput, parseGpInput } from './gp-money';

test('whole and decimal gp convert exactly to copper', () => {
  expect(parseGpInput('30')).toEqual({ status: 'valid', copper: 3000 });
  expect(parseGpInput('12.5')).toEqual({ status: 'valid', copper: 1250 });
  expect(parseGpInput('0.07')).toEqual({ status: 'valid', copper: 7 });
  expect(parseGpInput('0')).toEqual({ status: 'valid', copper: 0 });
});

test('empty input differs from malformed, too-precise or oversized gp', () => {
  expect(parseGpInput('')).toEqual({ status: 'empty' });
  expect(parseGpInput('   ')).toEqual({ status: 'empty' });
  expect(parseGpInput('12a')).toEqual({
    status: 'invalid',
    message: 'Enter an amount in gp, such as 12 or 0.07.',
  });
  expect(parseGpInput('-3')).toMatchObject({ status: 'invalid' });
  expect(parseGpInput('1e3')).toMatchObject({ status: 'invalid' });
  expect(parseGpInput('.5')).toMatchObject({ status: 'invalid' });
  expect(parseGpInput('0.075')).toEqual({
    status: 'invalid',
    message: 'Use at most two decimal places (1 cp = 0.01 gp).',
  });
  expect(parseGpInput('999999999999999999')).toEqual({
    status: 'invalid',
    message: 'Enter a smaller amount.',
  });
});

test('a trailing decimal point is accepted while typing', () => {
  expect(parseGpInput('12.')).toEqual({ status: 'valid', copper: 1200 });
});

test('stored copper is shown as editable gp and parses back unchanged', () => {
  expect(copperToGpInput(3000)).toBe('30');
  expect(copperToGpInput(1250)).toBe('12.5');
  expect(copperToGpInput(1205)).toBe('12.05');
  expect(copperToGpInput(7)).toBe('0.07');
  expect(copperToGpInput(0)).toBe('0');
  expect(copperToGpInput(123456789)).toBe('1234567.89');
  for (const copper of [0, 7, 70, 1205, 99999, 900719925474099])
    expect(parseGpInput(copperToGpInput(copper))).toEqual({
      status: 'valid',
      copper,
    });
});
