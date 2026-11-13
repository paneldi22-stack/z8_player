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
    const src = await Storage
