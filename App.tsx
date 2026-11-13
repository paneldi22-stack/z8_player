import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

  useEffect(() => {
    initApp();
  }, []);

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
      const epg = await fetchEpgMap(src.epgUrl);
      setItems(loaded);
      setEpgMap(epg);
      setSelectedCat('All');
    } catch (e: any) {
      Alert.alert('خطأ في التحميل', e?.message || 'تعذر الاتصال بالسيرفر');
    } finally {
      setLoading(false);
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
        Alert.alert('تم', 'تم حفظ الرمز السري بنجاح');
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
      Alert.alert('خطأ', 'الرمز السري غير صحيح');
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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => setMultiScreenOpen(true)}
          >
            <Text style={styles.topBtnText}>4 شاشات</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => setHasSource(false)}
          >
            <Text style={styles.topBtnText}>السيرفر</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>جاري تحميل الباقة...</Text>
        </View>
      ) : tab === 'live' || tab === 'movie' ? (
        <View style={{ flex: 1 }}>
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن قناة أو فيلم..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
          />
          <View style={{ height: 44 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
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
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {epg ? `الآن: ${epg}` : item.category}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : tab === 'fav' ? (
        <ScrollView style={{ padding: 16 }}>
          <Text style={styles.sectionTitle}>إكمال المشاهدة</Text>
          {history.map((h) => (
            <TouchableOpacity
              key={h.item.streamUrl}
              style={styles.card}
              onPress={() => handleSelectItem(h.item)}
            >
              <Text style={styles.cardTitle}>{h.item.name}</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>المفضلة</Text>
          {favorites.map((f) => (
            <TouchableOpacity
              key={f.streamUrl}
              style={styles.card}
              onPress={() => handleSelectItem(f)}
            >
              <Text style={styles.cardTitle}>❤️ {f.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <ScrollView style={{ padding: 16 }}>
          <TouchableOpacity style={styles.actionBtn} onPress={loadPlaylist}>
            <Text style={styles.actionBtnText}>تحديث القائمة الآن</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setSettingNewPin(true);
              setPinInput('');
              setPinModalVisible(true);
            }}
          >
            <Text style={styles.actionBtnText}>
              تعيين رمز الرقابة الأبوية (PIN)
            </Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
            قفل الفئات برمز سري
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

      <View style={styles.navBar}>
        {[
          { key: 'live', label: 'القنوات' },
          { key: 'movie', label: 'الأفلام' },
          { key: 'fav', label: 'مفضلتي' },
          { key: 'settings', label: 'الإعدادات' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={styles.navItem}
            onPress={() => {
              setTab(t.key as any);
              setSelectedCat('All');
            }}
          >
            <Text
              style={[
                styles.navText,
                tab === t.key && { color: '#F59E0B', fontWeight: 'bold' },
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.pinBox}>
            <Text style={styles.pinTitle}>
              {settingNewPin ? 'أدخل رمز PIN من 4 أرقام' : 'أدخل الرمز السري'}
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
                <Text style={styles.topBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.topBtn, { backgroundColor: '#F59E0B' }]}
                onPress={handlePinConfirm}
              >
                <Text style={{ color: '#000', fontWeight: 'bold' }}>تأكيد</Text>
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
    padding: 14,
    backgroundColor: '#161B22',
  },
  headerTitle: { color: '#F59E0B', fontSize: 18, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', gap: 8 },
  topBtn: {
    backgroundColor: '#21262D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  topBtnText: { color: '#FFF', fontSize: 12 },
  searchInput: {
    backgroundColor: '#1A1F29',
    color: '#FFF',
    margin: 10,
    padding: 10,
    borderRadius: 8,
  },
  chip: {
    backgroundColor: '#1F242D',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    height: 36,
  },
  activeChip: { backgroundColor: '#F59E0B' },
  chipText: { color: '#CCC', fontSize: 13 },
  activeChipText: { color: '#000', fontWeight: 'bold' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    marginHorizontal: 10,
    marginVertical: 4,
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  cardIcon: { fontSize: 20 },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  cardSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  sectionTitle: { color: '#F59E0B', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  actionBtn: {
    backgroundColor: '#1F242D',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  actionBtnText: { color: '#F59E0B', fontWeight: 'bold' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#1F242D',
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#161B22',
    borderTopWidth: 1,
    borderColor: '#21262D',
  },
  navItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  navText: { color: '#9CA3AF', fontSize: 13 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBox: {
    backgroundColor: '#161B22',
    padding: 24,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
  },
  pinTitle: { color: '#FFF', fontSize: 16, marginBottom: 12 },
  pinInput: {
    backgroundColor: '#0E1117',
    color: '#FFF',
    width: '60%',
    textAlign: 'center',
    fontSize: 20,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
});
