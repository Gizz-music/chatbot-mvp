export const assertEquals = <T>(actual: T, expected: T): void => {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);

  if (left !== right) {
    throw new Error(`expected ${right}, got ${left}`);
  }
};
