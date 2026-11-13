import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  StyleSheet,
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
import { MainScreen } from './src/MainScreen';
import { MultiScreen } from './src/MultiScreen';
import { PlayerScreen } from './src/PlayerScreen';
import { StorageService } from './src/storage';
import {
  EpgProgram,
  MediaItem,
  PlaylistSource,
  WatchProgress,
} from './src/types';

export default function App() {
  const [lang, setLang] = useState<AppLang>('ar');
  const t = TRANSLATIONS[lang];

  const [showIntro, setShowIntro] = useState(true);
  const [source, setSource] = useState<PlaylistSource | null>(null);
  const [hasSource, setHasSource] = useState<boolean | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [epgMap, setEpgMap] = useState<Record<string, EpgProgram>>({});
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [lockedCats, setLockedCats] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [playingItem, setPlayingItem] = useState<MediaItem | null>(null);
  const [playingList, setPlayingList] = useState<MediaItem[]>([]);
  const [multiScreenOpen, setMultiScreenOpen] = useState(false);

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pendingPlay, setPendingPlay] = useState<{
    item: MediaItem;
    list: MediaItem[];
  } | null>(null);
  const [settingNewPin, setSettingNewPin] = useState(false);

  const handleIntroFinish = useCallback(() => setShowIntro(false), []);

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
    setSource(src);
    setHasSource(true);
    await refreshUserData();
    await loadPlaylist(src);
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

  const loadPlaylist = async (activeSrc?: PlaylistSource | null) => {
    const src = activeSrc || (await StorageService.getSource());
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
      setLoading(false);
      fetchEpgMap(src.epgUrl).then(setEpgMap).catch(() => {});
    } catch (e: any) {
      setLoading(false);
      Alert.alert(t.loadError, e?.message || t.serverConnectError);
    }
  };

  const handlePlayItem = async (item: MediaItem, list: MediaItem[]) => {
    if (lockedCats.includes(item.category)) {
      const savedPin = await StorageService.getPin();
      if (savedPin) {
        setPendingPlay({ item, list });
        setSettingNewPin(false);
        setPinInput('');
        setPinModalVisible(true);
        return;
      }
    }
    setPlayingList(list);
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
    if (pinInput === savedPin && pendingPlay) {
      setPinModalVisible(false);
      setPlayingList(pendingPlay.list);
      setPlayingItem(pendingPlay.item);
      setPendingPlay(null);
    } else {
      Alert.alert(t.error, t.wrongPin);
    }
  };

  if (showIntro) return <IntroScreen onFinish={handleIntroFinish} />;

  if (hasSource === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#C8E64C" />
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
        channelList={playingList}
        lang={lang}
        onSelectChannel={(next) => setPlayingItem(next)}
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

  return (
    <>
      <MainScreen
        title={source?.name || 'Z8 Player'}
        source={source}
        lang={lang}
        items={items}
        epgMap={epgMap}
        favorites={favorites}
        history={history}
        lockedCats={lockedCats}
        loading={loading}
        onChangeLang={changeLanguage}
        onPlayItem={handlePlayItem}
        onOpenMultiScreen={() => setMultiScreenOpen(true)}
        onOpenServer={() => setHasSource(false)}
        onRefresh={() => loadPlaylist(source)}
        onOpenSetPin={() => {
          setSettingNewPin(true);
          setPinInput('');
          setPinModalVisible(true);
        }}
        onToggleLockCat={async (cat) => {
          const updated = await StorageService.toggleCategoryLock(cat);
          setLockedCats(updated);
        }}
      />

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
                style={styles.btn}
                onPress={() => setPinModalVisible(false)}
              >
                <Text style={{ color: '#FFF', fontSize: 12 }}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#C8E64C' }]}
                onPress={handlePinConfirm}
              >
                <Text style={{ color: '#0B132B', fontWeight: 'bold' }}>
                  {t.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0B132B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBox: {
    backgroundColor: '#162447',
    padding: 20,
    borderRadius: 12,
    width: '45%',
    alignItems: 'center',
  },
  pinTitle: { color: '#FFF', fontSize: 15, marginBottom: 10 },
  pinInput: {
    backgroundColor: '#0B132B',
    color: '#FFF',
    width: '60%',
    textAlign: 'center',
    fontSize: 18,
    padding: 8,
    borderRadius: 8,
    marginBottom: 14,
  },
  btn: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
