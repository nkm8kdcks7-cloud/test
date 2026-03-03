
import type { GameState } from './engine';
import { cloudGetItem, cloudRemoveItem, cloudSetItem, hasCloudStorage } from './telegram';

const LOCAL_KEY = 'eternos_save_v3';
const CLOUD_KEY = 'eternos_save_v3';

export function saveLocal(state: GameState) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

export function loadLocal(): GameState | null {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as GameState; } catch { return null; }
}

export function clearLocal() {
  localStorage.removeItem(LOCAL_KEY);
}

export function canUseCloud(): boolean {
  return hasCloudStorage();
}

export async function loadCloud(): Promise<GameState | null> {
  if (!canUseCloud()) return null;
  const raw = await cloudGetItem(CLOUD_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as GameState; } catch { return null; }
}

export async function saveCloud(state: GameState): Promise<boolean> {
  if (!canUseCloud()) return false;
  try { return await cloudSetItem(CLOUD_KEY, JSON.stringify(state)); } catch { return false; }
}

export async function clearCloud(): Promise<boolean> {
  if (!canUseCloud()) return false;
  return await cloudRemoveItem(CLOUD_KEY);
}
