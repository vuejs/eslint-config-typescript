// This file is for some generic helper functions that aren't tied to the main functionality of the project.

export function omit<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keys.includes(key as K))
  ) as Omit<T, K>;
}

// https://dev.to/nexxeln/implementing-the-pipe-operator-in-typescript-30ip
interface Pipe {
  <A>(value: A): A;
  <A, B>(value: A, fn1: (input: A) => B): B;
  <A, B, C>(value: A, fn1: (input: A) => B, fn2: (input: B) => C): C;
  <A, B, C, D>(
    value: A,
    fn1: (input: A) => B,
    fn2: (input: B) => C,
    fn3: (input: C) => D
  ): D;
  <A, B, C, D, E>(
    value: A,
    fn1: (input: A) => B,
    fn2: (input: B) => C,
    fn3: (input: C) => D,
    fn4: (input: D) => E
  ): E;
  <A, B, C, D, E, F>(
    value: A,
    fn1: (input: A) => B,
    fn2: (input: B) => C,
    fn3: (input: C) => D,
    fn4: (input: D) => E,
    fn5: (input: E) => F
  ): F;
  // ... and so on
}

export const pipe: Pipe = (value: any, ...fns: Function[]): unknown => {
  return fns.reduce((acc, fn) => fn(acc), value);
};


export function partition<T>(
  array: T[],
  predicate: (element: T) => boolean,
): [T[], T[]] {
  const truthy: T[] = []
  const falsy: T[] = []
  for (const element of array) {
    if (predicate(element)) {
      truthy.push(element)
    } else {
      falsy.push(element)
    }
  }
  return [truthy, falsy]
}
