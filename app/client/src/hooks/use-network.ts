import { useState, useEffect } from 'react';

export function useNetwork() {
  const [online, setOnline] = useState(navigator.onLine);
  const [since, setSince] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setSince(new Date());
    };

    const handleOffline = () => {
      setOnline(false);
      setSince(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial timestamp if online
    if (online) {
      setSince(new Date());
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    online,
    since,
    isOnline: () => navigator.onLine
  };
} 