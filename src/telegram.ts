
declare global {
  interface Window {
    Telegram?: any;
  }
}

export function getWebApp() {
  return window.Telegram?.WebApp;
}

export function initTelegramUI() {
  const tg = getWebApp();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
  } catch {
    // ignore
  }
}

export type HapticType = 'impact'|'notification'|'selection';

export function haptic(type: HapticType = 'selection', detail?: 'light'|'medium'|'heavy'|'success'|'warning'|'error') {
  const tg = getWebApp();
  const h = tg?.HapticFeedback;
  if (!h) return;

  try {
    if (type === 'selection') {
      h.selectionChanged();
      return;
    }
    if (type === 'impact') {
      h.impactOccurred(detail ?? 'light');
      return;
    }
    h.notificationOccurred(detail ?? 'success');
  } catch {
    // ignore
  }
}

export function hasCloudStorage(): boolean {
  return Boolean(getWebApp()?.CloudStorage);
}

export function cloudGetItem(key: string): Promise<string | null> {
  const tg = getWebApp();
  const cs = tg?.CloudStorage;
  if (!cs) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      cs.getItem(key, (err: any, value: string | null) => {
        if (err) return resolve(null);
        resolve(value ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

export function cloudSetItem(key: string, value: string): Promise<boolean> {
  const tg = getWebApp();
  const cs = tg?.CloudStorage;
  if (!cs) return Promise.resolve(false);

  return new Promise((resolve) => {
    try {
      cs.setItem(key, value, (err: any) => resolve(!err));
    } catch {
      resolve(false);
    }
  });
}

export function cloudRemoveItem(key: string): Promise<boolean> {
  const tg = getWebApp();
  const cs = tg?.CloudStorage;
  if (!cs) return Promise.resolve(false);

  return new Promise((resolve) => {
    try {
      cs.removeItem(key, (err: any) => resolve(!err));
    } catch {
      resolve(false);
    }
  });
}
