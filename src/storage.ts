import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveSource, MediaItem, WatchProgress } from './types';

const KEYS = {
  SOURCE: 'z8_active_source',
  FAVORITES: 'z8_favorites',
  HISTORY: 'z8_watch_history',
  PIN: 'z8_parental_pin',
  LOCKED_CATS: 'z8_locked_categories',
};

export const StorageService = {
  async saveSource(source: ActiveSource): Promise<void> {
    await AsyncStorage.setItem(KEYS.SOURCE, JSON.stringify(source));
  },

  async getSource(): Promise<ActiveSource | null> {
    const raw = await AsyncStorage.getItem(KEYS.SOURCE);
    return raw ? (JSON.parse(raw) as ActiveSource) : null;
  },

  async getFavorites(): Promise<MediaItem[]> {
    const raw = await AsyncStorage.getItem(KEYS.FAVORITES);
    return raw ? (JSON.parse(raw) as MediaItem[]) : [];
  },

  async toggleFavorite(item: MediaItem): Promise<boolean> {
    const list = await this.getFavorites();
    const exists = list.some((x) => x.streamUrl === item.streamUrl);
    const updated = exists
      ? list.filter((x) => x.streamUrl !== item.streamUrl)
      : [item, ...list];
    await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));
    return !exists;
  },

  async isFavorite(streamUrl: string): Promise<boolean> {
    const list = await this.getFavorites();
    return list.some((x) => x.streamUrl === streamUrl);
  },

  async getHistory(): Promise<WatchProgress[]> {
    const raw = await AsyncStorage.getItem(KEYS.HISTORY);
    return raw ? (JSON.parse(raw) as WatchProgress[]) : [];
  },

  async saveProgress(
    item: MediaItem,
    positionMillis: number,
    durationMillis: number
  ): Promise<void> {
    if (positionMillis < 5000) return;
    const list = await this.getHistory();
    const filtered = list.filter((x) => x.item.streamUrl !== item.streamUrl);
    const updated: WatchProgress[] = [
      { item, positionMillis, durationMillis },
      ...filtered,
    ].slice(0, 30);
    await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
  },

  async getSavedPosition(streamUrl: string): Promise<number> {
    const list = await this.getHistory();
    const found = list.find((x) => x.item.streamUrl === streamUrl);
    return found ? found.positionMillis : 0;
  },

  async setPin(pin: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.PIN, pin);
  },

  async getPin(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.PIN);
  },

  async getLockedCategories(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(KEYS.LOCKED_CATS);
    return raw ? (JSON.parse(raw) as string[]) : [];
  },

  async toggleCategoryLock(category: string): Promise<string[]> {
    const list = await this.getLockedCategories();
    const updated = list.includes(category)
      ? list.filter((c) => c !== category)
      : [...list, category];
    await AsyncStorage.setItem(KEYS.LOCKED_CATS, JSON.stringify(updated));
    return updated;
  },
};
