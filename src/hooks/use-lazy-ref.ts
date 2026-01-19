import * as React from 'react';

function useLazyRef<T>(fn: () => T) {
  const ref = React.useRef<T | null>(null);

  if (ref.current === null) {
    ref.current = fn();
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Safe: ref.current is guaranteed to be T after initialization
  return ref as React.RefObject<T>;
}

export { useLazyRef };
