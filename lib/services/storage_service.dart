import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/media_models.dart';

class StorageService {
  static const _favKey = 'z8_favorites';
  static const _historyKey = 'z8_watch_history';
  static const _pinKey = 'z8_parental_pin';
  static const _lockedCatsKey = 'z8_locked_categories';
  static const _activeSourceKey = 'z8_active_source';

  // --- حفظ بيانات الدخول (Xtream أو M3U) ---
  Future<void> saveActiveSource(Map<String, String> source) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_activeSourceKey, jsonEncode(source));
  }

  Future?> getActiveSource() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_activeSourceKey);
    if (raw == null || raw.isEmpty) return null;
    final Map<String, dynamic> decoded = jsonDecode(raw);
    return decoded.map((k, v) => MapEntry(k, v.toString()));
  }

  Future<void> clearActiveSource() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_activeSourceKey);
  }

  // --- المفضلة (Favorites) ---
  Future<List<MediaItem>> getFavorites() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_favKey) ?? [];
    return raw.map((e) => MediaItem.fromJson(jsonDecode(e))).toList();
  }

  Future<void> toggleFavorite(MediaItem item) async {
    final prefs = await SharedPreferences.getInstance();
    final list = await getFavorites();
    final exists = list.any((e) => e.streamUrl == item.streamUrl);
    if (exists) {
      list.removeWhere((e) => e.streamUrl == item.streamUrl);
    } else {
      list.add(item);
    }
    await prefs.setStringList(
        _favKey, list.map((e) => jsonEncode(e.toJson())).toList());
  }

  Future<bool> isFavorite(String streamUrl) async {
    final list = await getFavorites();
    return list.any((e) => e.streamUrl == streamUrl);
  }

  // --- إكمال المشاهدة (Continue Watching) ---
  Future<List<WatchProgress>> getWatchHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_historyKey) ?? [];
    return raw.map((e) => WatchProgress.fromJson(jsonDecode(e))).toList();
  }

  Future<void> saveProgress(
      MediaItem item, int positionSec, int durationSec) async {
    if (positionSec < 5) return;
    final prefs = await SharedPreferences.getInstance();
    final list = await getWatchHistory();
    list.removeWhere((e) => e.item.streamUrl == item.streamUrl);
    list.insert(
      0,
      WatchProgress(
        item: item,
        positionSeconds: positionSec,
        durationSeconds: durationSec,
      ),
    );
    if (list.length > 30) list.removeLast();
    await prefs.setStringList(
        _historyKey, list.map((e) => jsonEncode(e.toJson())).toList());
  }

  Future<int> getSavedPosition(String streamUrl) async {
    final list = await getWatchHistory();
    final match = list.where((e) => e.item.streamUrl == streamUrl);
    return match.isNotEmpty ? match.first.positionSeconds : 0;
  }

  // --- الرقابة الأبوية (Parental Control) ---
  Future<void> setParentalPin(String pin) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_pinKey, pin);
  }

  Future<String?> getParentalPin() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_pinKey);
  }

  Future<List<String>> getLockedCategories() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_lockedCatsKey) ?? [];
  }

  Future<void> toggleCategoryLock(String category) async {
    final prefs = await SharedPreferences.getInstance();
    final locked = await getLockedCategories();
    if (locked.contains(category)) {
      locked.remove(category);
    } else {
      locked.add(category);
    }
    await prefs.setStringList(_lockedCatsKey, locked);
  }
}
