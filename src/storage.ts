import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppLang } from './i18n';
import { MediaItem, PlaylistSource, WatchProgress } from './types';

const KEYS = {
  SOURCE: 'z8_source_v1',
  FAVORITES: 'z8_favorites_v1',
  HISTORY: 'z8_history_v1',
  PIN: 'z8_pin_v1',
  LOCKED_CATS: 'z8_locked_cats_v1',
  LANG: 'z8_lang_v1',
};

export const StorageService = {
  async getLanguage(): Promise<AppLang> {
    const val = await AsyncStorage.getItem(KEYS.LANG);
    return val === 'fr' || val === 'en' ? val : 'ar';
  },

  async setLanguage(lang: AppLang): Promise<void> {
    await AsyncStorage.setItem(KEYS.LANG, lang);
  },

  async getSource(): Promise<PlaylistSource | null> {
    const raw = await AsyncStorage.getItem(KEYS.SOURCE);
    return raw ? JSON.parse(raw) : null;
  },

  async saveSource(source: PlaylistSource): Promise<void> {
    await AsyncStorage.setItem(KEYS.SOURCE, JSON.stringify(source));
  },

  async getFavorites(): Promise<MediaItem[]> {
    const raw = await AsyncStorage.getItem(KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [];
  },

  async isFavorite(streamUrl: string): Promise<boolean> {
    const list = await this.getFavorites();
    return list.some((x) => x.streamUrl === streamUrl);
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

  async getHistory(): Promise<WatchProgress[]> {
    const raw = await AsyncStorage.getItem(KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  },

  async saveProgress(
    item: MediaItem,
    positionMs: number,
    durationMs: number
  ): Promise<void> {
    const list = await this.getHistory();
    const filtered = list.filter((x) => x.item.streamUrl !== item.streamUrl);
    const updated: WatchProgress[] = [
      { item, positionMs, durationMs, updatedAt: Date.now() },
      ...filtered,
    ].slice(0, 40);
    await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
  },

  async getSavedPosition(streamUrl: string): Promise<number> {
    const list = await this.getHistory();
    const found = list.find((x) => x.item.streamUrl === streamUrl);
    return found ? found.positionMs : 0;
  },

  async getPin(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.PIN);
  },

  async setPin(pin: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.PIN, pin);
  },

  async getLockedCategories(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(KEYS.LOCKED_CATS);
    return raw ? JSON.parse(raw) : [];
  },

  async toggleCategoryLock(category: string): Promise<string[]> {
    const list = await this.getLockedCategories();
    const exists = list.includes(category);
    const updated = exists
      ? list.filter((c) => c !== category)
      : [...list, category];
    await AsyncStorage.setItem(KEYS.LOCKED_CATS, JSON.stringify(updated));
    return updated;
  },
};
