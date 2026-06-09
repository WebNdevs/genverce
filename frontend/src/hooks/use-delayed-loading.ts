import { useState, useEffect } from 'react';

/**
 * Custom hook to delay setting loading state to true.
 * This prevents visual flickers (like skeletons) for very fast or cached requests.
 * 
 * @param loading Raw loading state from a query or async operation
 * @param delay Delay in milliseconds (default: 250)
 * @returns boolean Delayed loading state
 */
export function useDelayedLoading(loading: boolean, delay = 250): boolean {
  const [delayedLoading, setDelayedLoading] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setDelayedLoading(true);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setDelayedLoading(false);
    }
  }, [loading, delay]);

  return delayedLoading;
}
