// Custom hook that fetches from IndexedDB cache first while background-syncing with Firestore
import { useState, useEffect } from "react";
import { dataManager, type DashboardData } from "../lib/data-manager";
import type { FirebaseUser } from "firebase/auth";

export function useCachedSessions(user?: FirebaseUser | null) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      // 1. Load from IndexedDB cache first (0 Firestore reads on initial render)
      const cached = await dataManager.getCachedDashboardData(user.uid);
      if (cached && isMounted) {
        setData(cached);
        setLoading(false);
      }

      // 2. Background sync with Firestore to minimize read operations while keeping fresh
      setSyncing(true);
      try {
        const fresh = await dataManager.fetchAndCacheFreshData(user.uid);
        if (isMounted) {
          setData(fresh);
        }
      } catch (err) {
        console.warn("Background sync failed:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setSyncing(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  return {
    data,
    loading,
    syncing,
    refresh: async () => {
      if (!user) return;
      setSyncing(true);
      try {
        const fresh = await dataManager.fetchAndCacheFreshData(user.uid);
        setData(fresh);
      } finally {
        setSyncing(false);
      }
    },
  };
}
