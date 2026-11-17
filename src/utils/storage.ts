/**
 * localStorage 安全封装。
 * 无痕模式 / 禁用 Cookie / 存储配额满时 localStorage 可能直接抛错，
 * 这里统一 try/catch 并降级到内存存储，保证页面在任何情况下都不崩。
 */

const PREFIX = 'hantools:';
const SCHEMA = 'v1';
const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    const probe = `${PREFIX}__probe__`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export const storageKeys = {
  favorites: 'favorites',
  recents: 'recents',
  lastCategory: 'last-category',
} as const;

export type StorageKey = (typeof storageKeys)[keyof typeof storageKeys];

function fullKey(key: string): string {
  return `${PREFIX}${SCHEMA}:${key}`;
}

export function readRaw(key: string): string | null {
  const store = storage();
  if (!store) return memory.get(fullKey(key)) ?? null;
  try {
    return store.getItem(fullKey(key));
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): boolean {
  const store = storage();
  if (!store) {
    memory.set(fullKey(key), value);
    return true;
  }
  try {
    store.setItem(fullKey(key), value);
    return true;
  } catch {
    memory.set(fullKey(key), value);
    return false;
  }
}

export function removeKey(key: string): void {
  const store = storage();
  memory.delete(fullKey(key));
  if (!store) return;
  try {
    store.removeItem(fullKey(key));
  } catch {
    /* 忽略：存储不可用时无需处理 */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') {
      return typeof parsed === typeof fallback ? (parsed as T) : fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

/** 收藏（slug 列表，去重并限制长度，避免 localStorage 被写满） */
const MAX_FAVORITES = 200;
const MAX_RECENTS = 20;

export function getFavorites(): string[] {
  const list = readJSON<string[]>(storageKeys.favorites, []);
  return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
}

export function isFavorite(slug: string): boolean {
  return getFavorites().includes(slug);
}

export function toggleFavorite(slug: string): boolean {
  const current = getFavorites();
  const exists = current.includes(slug);
  const next = exists ? current.filter((item) => item !== slug) : [slug, ...current];
  writeJSON(storageKeys.favorites, next.slice(0, MAX_FAVORITES));
  return !exists;
}

export function getRecents(): string[] {
  const list = readJSON<string[]>(storageKeys.recents, []);
  return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
}

export function pushRecent(slug: string): void {
  const next = [slug, ...getRecents().filter((item) => item !== slug)];
  writeJSON(storageKeys.recents, next.slice(0, MAX_RECENTS));
}

export function clearUserData(): void {
  for (const key of Object.values(storageKeys)) removeKey(key);
  // 兼容旧版本（v0.x 存过浅色/深色主题）遗留的键
  removeKey('theme');
}
