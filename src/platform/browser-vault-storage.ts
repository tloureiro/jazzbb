export type StorageEstimate = {
  usage: number;
  quota: number;
};

type Listener = (estimate: StorageEstimate | null) => void;

let overrideEstimate: StorageEstimate | null = null;
let lastEstimate: StorageEstimate | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener(lastEstimate));
}

export function subscribeBrowserVaultEstimate(listener: Listener): () => void {
  listeners.add(listener);
  listener(lastEstimate);
  return () => {
    listeners.delete(listener);
  };
}

export function setBrowserVaultEstimateOverride(estimate: StorageEstimate): void {
  overrideEstimate = estimate;
  lastEstimate = estimate;
  notify();
}

export function clearBrowserVaultEstimateOverride(): void {
  overrideEstimate = null;
  void refreshBrowserVaultEstimate();
}

export async function refreshBrowserVaultEstimate(): Promise<void> {
  if (overrideEstimate) {
    lastEstimate = overrideEstimate;
    notify();
    return;
  }

  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    lastEstimate = null;
    notify();
    return;
  }

  try {
    const result = await navigator.storage.estimate();
    if (typeof result.usage === 'number' && typeof result.quota === 'number') {
      lastEstimate = { usage: result.usage, quota: result.quota };
    } else {
      lastEstimate = null;
    }
  } catch (error) {
    console.warn('Failed to estimate storage usage', error);
    lastEstimate = null;
  }

  notify();
}

export function getLastBrowserVaultEstimate(): StorageEstimate | null {
  return lastEstimate;
}
