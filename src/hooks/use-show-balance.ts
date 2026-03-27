/**
 * Show Balance Preference Hook
 * localStorage-backed toggle for always showing credit balance in the header
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'openstory:show-balance';

export function useShowBalance() {
  const [show, setShow] = useState(false);

  // Hydration-safe: load real value in useEffect
  useEffect(() => {
    setShow(localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  const setShowBalance = useCallback((value: boolean) => {
    setShow(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  return { showBalance: show, setShowBalance };
}
