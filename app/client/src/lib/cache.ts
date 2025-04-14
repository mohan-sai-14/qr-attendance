interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

export function setCache<T>(key: string, data: T, expiresIn: number = 3600000): void {
  const item: CacheItem<T> = {
    data,
    timestamp: Date.now(),
    expiresIn,
  };
  try {
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
}

export function getCache<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const parsedItem: CacheItem<T> = JSON.parse(item);
    const now = Date.now();

    if (now - parsedItem.timestamp > parsedItem.expiresIn) {
      localStorage.removeItem(key);
      return null;
    }

    return parsedItem.data;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

export function clearCache(key?: string): void {
  try {
    if (key) {
      localStorage.removeItem(key);
    } else {
      localStorage.clear();
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export function getCacheTimestamp(key: string): Date | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const parsedItem: CacheItem<any> = JSON.parse(item);
    return new Date(parsedItem.timestamp);
  } catch (error) {
    console.error('Error getting cache timestamp:', error);
    return null;
  }
} 