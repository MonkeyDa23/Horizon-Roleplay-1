
import React, { useState, useEffect, useCallback, useRef } from 'react';

export function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        // Only parse if item exists and is not "undefined"
        if (item && item !== 'undefined') {
            return JSON.parse(item);
        }
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
    return initialValue;
  });

  // Use a ref to prevent the effect from running on mount if state hasn't changed (though generic useEffect runs anyway)
  // We rely on React's state stability.
  
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        if (state === undefined) {
            window.localStorage.removeItem(key);
        } else {
            window.localStorage.setItem(key, JSON.stringify(state));
        }
      }
    } catch (error) {
      console.warn(`Error saving localStorage key "${key}":`, error);
    }
  }, [key, state]);

  const clearState = useCallback(() => {
      if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
      }
      setState(initialValue);
  }, [key, initialValue]);

  return [state, setState, clearState];
}
