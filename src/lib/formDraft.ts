type StoredDraft<T> = { version: number; savedAt: string; data: T };

export function loadDraft<T>(key: string, version: number): { data: T; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDraft<T>;
    if (stored?.version !== version || !stored.data) return null;
    return { data: stored.data, savedAt: stored.savedAt };
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, version: number, data: T): string | null {
  const savedAt = new Date().toISOString();
  try {
    localStorage.setItem(key, JSON.stringify({ version, savedAt, data } satisfies StoredDraft<T>));
    return savedAt;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
}
