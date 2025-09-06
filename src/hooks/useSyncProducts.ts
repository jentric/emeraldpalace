import { useState, useCallback } from 'react';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncedAt?: Date;
  error?: string;
}

export function useSyncProducts() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
  });

  const syncProducts = useCallback(async () => {
    try {
      setSyncStatus(prev => ({ ...prev, isSyncing: true, error: undefined }));

      // TODO: Replace with actual sync logic
      // This could involve API calls to sync with external services
      await new Promise(resolve => setTimeout(resolve, 2000)); // Mock delay

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncedAt: new Date(),
      }));
    } catch (err) {
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setSyncStatus(prev => ({ ...prev, error: undefined }));
  }, []);

  return {
    syncStatus,
    syncProducts,
    clearError,
  };
}