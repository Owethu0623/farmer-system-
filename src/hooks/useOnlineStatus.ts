import { useEffect, useState } from 'react';

const SIMULATED_OFFLINE_KEY = 'fieldshift_simulated_offline';

export function useOnlineStatus() {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    const handleCustomToggle = () => {
      try {
        setSimulatedOffline(window.localStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true');
      } catch {
        // ignore
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('fieldshift-offline-toggle', handleCustomToggle);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('fieldshift-offline-toggle', handleCustomToggle);
    };
  }, []);

  const toggleSimulatedOffline = (next?: boolean) => {
    const target = typeof next === 'boolean' ? next : !simulatedOffline;
    setSimulatedOffline(target);
    try {
      if (target) {
        window.localStorage.setItem(SIMULATED_OFFLINE_KEY, 'true');
      } else {
        window.localStorage.removeItem(SIMULATED_OFFLINE_KEY);
      }
      window.dispatchEvent(new Event('fieldshift-offline-toggle'));
    } catch {
      // ignore
    }
  };

  return {
    isOnline: browserOnline && !simulatedOffline,
    browserOnline,
    simulatedOffline,
    toggleSimulatedOffline,
  };
}
