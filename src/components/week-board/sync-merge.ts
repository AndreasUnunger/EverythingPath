'use client';

export function mergeSyncedValue<T>({
  currentValue,
  previousServerValue,
  nextServerValue,
  resetToServer = false,
  isEqual = Object.is,
}: {
  currentValue: T;
  previousServerValue: T;
  nextServerValue: T;
  resetToServer?: boolean;
  isEqual?: (left: T, right: T) => boolean;
}) {
  if (resetToServer) {
    return nextServerValue;
  }

  const shouldAcceptServerValue =
    isEqual(currentValue, previousServerValue) ||
    isEqual(currentValue, nextServerValue);

  return shouldAcceptServerValue ? nextServerValue : currentValue;
}

export function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
