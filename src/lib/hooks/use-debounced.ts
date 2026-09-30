import { useEffect, useState } from 'react';

/**
 * The value as it was `delay` ms ago, once it stops changing.
 *
 * For search fields: a keystroke must move the input immediately (that value
 * stays in component state) while the request waits for the typing to settle,
 * so a six-letter surname costs one round trip instead of six.
 *
 * Clearing is NOT delayed — an empty value settles on the next tick. Holding it
 * back would leave stale results under an empty field, which reads as a bug.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setSettled(value), value ? delay : 0);

    return () => clearTimeout(id);
  }, [value, delay]);

  return settled;
}
