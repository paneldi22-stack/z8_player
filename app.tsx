import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AppLang, TRANSLATIONS } from './src/i18n';
import { IntroScreen } from './src/IntroScreen';
import {
  fetchEpgMap,
  fetchM3uUrl,
  fetchXtreamAccount,
  parseM3uContent,
} from './src/iptv';
import { LoginScreen } from './src/LoginScreen';
import { MultiScreen } from './src/MultiScreen';
import { PlayerScreen } from './src/PlayerScreen';
import { StorageService } from './src/storage';
import { EpgProgram, MediaItem, WatchProgress } from './src/types';

export default function App() {
  const [lang, setLang] = useState<AppLang>('ar');
  const t = TRANSLATIONS[lang];

  const [showIntro, setShowIntro] = useState(true);
  const [hasSource, setHasSource] = useState<boolean | null>(null);
  const [title, setTitle] = useState('Z8 Player');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [epgMap, setEpgMap] = useState<Record<string, EpgProgram>>({});
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [lockedCats, setLockedCats] = useState<string[]>([]);

  const [tab, setTab] = useState<'live' | 'movie' | 'fav' | 'settings'>('live');
  const [selectedCat, setSelectedCat] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [playingItem, setPlayingItem] = useState<MediaItem | null>(null);
  const [multiScreenOpen, setMultiScreenOpen] = useState(false);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pendingItem, setPendingItem] = useState<MediaItem | null>(null);
  const [settingNewPin, setSettingNewPin] = useState(false);

  const handleIntroFinish = useCallback(() => {
    setShowIntro(false);
  }, []);

  const changeLanguage = async (newLang: AppLang) => {
    setLang(newLang);
    await StorageService.setLanguage(newLang);
  };

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    ).catch(() => {});
    StorageService.getLanguage().then(setLang);
    initApp();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (multiScreenOpen) {
        setMultiScreenOpen(false);
        return true;
      }
      if (pinModalVisible) {
        setPinModalVisible(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [multiScreenOpen, pinModalVisible]);

  const initApp = async () => {
    const src = await StorageService.getSource();
    if (!src) {
      setHasSource(false);
      return;
    }
    setHasSource(true);
    setTitle(src.name);
    await refreshUserData();
    await loadPlaylist();
  };

  const refreshUserData = async () => {
    const [favs, hist, locks] = await Promise.all([
      StorageService.getFavorites(),
      StorageService.getHistory(),
      StorageService.getLockedCategories(),
    ]);
    setFavorites(favs);
    setHistory(hist);
    setLockedCats(locks);
  };

  const loadPlaylist = async () => {
    const src = await StorageService.getSource();
    if (!src) return;
    setLoading(true);
    try {
      let loaded: MediaItem[] = [];
      if (src.type === 'xtream' && src.server && src.username && src.password) {
        loaded = await fetchXtreamAccount(src.server, src.username, src.password);
      } else if (src.type === 'file' && src.fileContent) {
        loaded = parseM3uContent(src.fileContent);
      } else if (src.m3uUrl) {
        loaded = await fetchM3uUrl(src.m3uUrl);
      }
      setItems(loaded);
      setSelectedCat('All');
      setLoading(false);
      fetchEpgMap(src.epgUrl).then(setEpgMap).catch(() => {});
    } catch (e: any) {
      setLoading(false);
      Alert.alert(t.loadError, e?.message || t.serverConnectError);
    }
  };

  const handleSelectItem = async (item: MediaItem) => {
    if (lockedCats.includes(item.category)) {
      const savedPin = await StorageService.getPin();
      if (savedPin) {
        setPendingItem(item);
        setSettingNewPin(false);
        setPinInput('');
        setPinModalVisible(true);
        return;
      }
    }
    setPlayingItem(item);
  };

  const handlePinConfirm = async () => {
    if (settingNewPin) {
      if (pinInput.length === 4) {
        await StorageService.setPin(pinInput);
        Alert.alert(t.saved, t.pinSaved);
      }
      setPinModalVisible(false);
      return;
    }

    const savedPin = await StorageService.getPin();
    if (pinInput === savedPin && pendingItem) {
      setPinModalVisible(false);
      setPlayingItem(pendingItem);
      setPendingItem(null);
    } else {
      Alert.alert(t.error, t.wrongPin);
    }
  };

  if (showIntro) {
    return <IntroScreen onFinish={handleIntroFinish} />;
  }

  if (hasSource === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  if (!hasSource) {
    return (
      <LoginScreen
        lang={lang}
        onChangeLang={changeLanguage}
        onSuccess={() => {
          setHasSource(true);
          initApp();
        }}
      />
    );
  }

  if (playingItem) {
    return (
      <PlayerScreen
        item={playingItem}
        lang={lang}
        onClose={() => {
          setPlayingItem(null);
          refreshUserData();
        }}
      />
    );
  }

  if (multiScreenOpen) {
    return (
      <MultiScreen
        channels={items.filter((x) => x.type === 'live')}
        onClose={() => setMultiScreenOpen(false)}
      />
    );
  }

  const currentTypeItems =
    tab === 'live' || tab === 'movie'
      ? items.filter((x) => x.type === tab)
      : [];
  const categories = [
    'All',
    ...Array.from(new Set(currentTypeItems.map((x) => x.category))),
  ];
  const filteredItems = currentTypeItems.filter((x) => {
    const matchCat = selectedCat === 'All' || x.category === selectedCat;
    const matchSearch =
      !search || x.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const allCategories = Array.from(new Set(items.map((x) => x.category)));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>

        <View style={styles.navInline}>
          {[
            { key: 'live', label: t.live },
            { key: 'movie', label: t.movies },
            { key: 'fav', label: t.favorites },
            { key: 'settings', label: t.settings },
          ].map((nav) => (
            <TouchableOpacity
              key={nav.key}
              style={[styles.navPill, tab === nav.key && styles.navPillActive]}
              onPress={() => {
                setTab(nav.key as any);
                setSelectedCat('All');
              }}
            >
              <Text
                style={[
                  styles.navPillText,
                  tab === nav.key && { color: '#000', fontWeight: 'bold' },
                ]}
              >
                {nav.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => setMultiScreenOpen(true)}
          >
            <Text style={styles.topBtnText}>{t.multiScreen}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => setHasSource(false)}
          >
            <Text style={styles.topBtnText}>{t.server}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>{t.loadingPlaylist}</Text>
        </View>
      ) : tab === 'live' || tab === 'movie' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.filterBar}>
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchPlaceholder}
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
            >
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    selectedCat === cat && styles.activeChip,
                  ]}
                  onPress={() => setSelectedCat(cat)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedCat === cat && styles.activeChipText,
                    ]}
                  >
                    {cat === 'All' ? t.all : cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredItems}
            numColumns={2}
            keyExtractor={(item) => item.id}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews
            contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 12 }}
            renderItem={({ item }) => {
              const epg = epgMap[item.epgId]?.title;
              const isLocked = lockedCats.includes(item.category);
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => handleSelectItem(item)}
                >
                  <Text style={styles.cardIcon}>
                    {isLocked ? '🔒' : tab === 'live' ? '📺' : '🎬'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {epg ? `${t.nowPlaying} ${epg}` : item.category}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : tab === 'fav' ? (
        <ScrollView style={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>{t.continueWatching}</Text>
          {history.map((h) => (
            <TouchableOpacity
              key={h.item.streamUrl}
              style={styles.cardFull}
              onPress={() => handleSelectItem(h.item)}
            >
              <Text style={styles.cardTitle}>{h.item.name}</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
            {t.myFavorites}
          </Text>
          {favorites.map((f) => (
            <TouchableOpacity
              key={f.streamUrl}
              style={styles.cardFull}
              onPress={() => handleSelectItem(f)}
            >
              <Text style={styles.cardTitle}>❤️ {f.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <ScrollView style={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>{t.languageLabel}</Text>
          <View style={styles.langSelector}>
            {[
              { code: 'ar', label: 'العربية' },
              { code: 'fr', label: 'Français' },
              { code: 'en', label: 'English' },
            ].map((item) => (
              <TouchableOpacity
                key={item.code}
                style={[
                  styles.langOption,
                  lang === item.code && styles.langOptionActive,
                ]}
                onPress={() => changeLanguage(item.code as AppLang)}
              >
                <Text
                  style={[
                    styles.langOptionText,
                    lang === item.code && { color: '#000', fontWeight: 'bold' },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.settingsActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={loadPlaylist}>
              <Text style={styles.actionBtnText}>{t.refreshPlaylist}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                setSettingNewPin(true);
                setPinInput('');
                setPinModalVisible(true);
              }}
            >
              <Text style={styles.actionBtnText}>{t.setPin}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
            {t.lockCategories}
          </Text>
          {allCategories.map((cat) => (
            <View key={cat} style={styles.switchRow}>
              <Text style={{ color: '#FFF', flex: 1 }}>{cat}</Text>
              <Switch
                value={lockedCats.includes(cat)}
                onValueChange={async () => {
                  const updated = await StorageService.toggleCategoryLock(cat);
                  setLockedCats(updated);
                }}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.pinBox}>
            <Text style={styles.pinTitle}>
              {settingNewPin ? t.enterNewPin : t.enterPin}
            </Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              value={pinInput}
              onChangeText={setPinInput}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={styles.topBtn}
                onPress={() => setPinModalVisible(false)}
              >
                <Text style={styles.topBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.topBtn, { backgroundColor: '#F59E0B' }]}
                onPress={handlePinConfirm}
              >
                <Text style={{ color: '#000', fontWeight: 'bold' }}>
                  {t.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1117' },
  center: {
    flex: 1,
    backgroundColor: '#0E1117',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#FFF', marginTop: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#161B22',
    gap: 10,
  },
  headerTitle: { color: '#F59E0B', fontSize: 17, fontWeight: 'bold' },
  navInline: { flexDirection: 'row', gap: 6 },
  navPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#21262D',
  },
  navPillActive: { backgroundColor: '#F59E0B' },
  navPillText: { color: '#CCC', fontSize: 12 },
  headerActions: { flexDirection: 'row', gap: 6 },
  topBtn: {
    backgroundColor: '#21262D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  topBtnText: { color: '#FFF', fontSize: 12 },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    backgroundColor: '#1A1F29',
    color: '#FFF',
    width: 210,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    fontSize: 13,
  },
  chip: {
    backgroundColor: '#1F242D',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    marginHorizontal: 3,
  },
  activeChip: { backgroundColor: '#F59E0B' },
  chipText: { color: '#CCC', fontSize: 12 },
  activeChipText: { color: '#000', fontWeight: 'bold' },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    margin: 4,
    padding: 10,
    borderRadius: 8,
    gap: 10,
  },
  cardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    marginVertical: 4,
    padding: 12,
    borderRadius: 8,
  },
  cardIcon: { fontSize: 18 },
  cardTitle: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  cardSub: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  sectionTitle: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  langSelector: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  langOption: {
    flex: 1,
    backgroundColor: '#1F242D',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  langOptionActive: { backgroundColor: '#F59E0B' },
  langOptionText: { color: '#FFF', fontWeight: '600' },
  settingsActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1F242D',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: { color: '#F59E0B', fontWeight: 'bold', fontSize: 13 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#1F242D',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBox: {
    backgroundColor: '#161B22',
    padding: 20,
    borderRadius: 12,
    width: '45%',
    alignItems: 'center',
  },
  pinTitle: { color: '#FFF', fontSize: 15, marginBottom: 10 },
  pinInput: {
    backgroundColor: '#0E1117',
    color: '#FFF',
    width: '60%',
    textAlign: 'center',
    fontSize: 18,
    padding: 8,
    borderRadius: 8,
    marginBottom: 14,
  },
});
