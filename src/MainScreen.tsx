import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { AppLang, TRANSLATIONS } from './i18n';
import { fetchSeriesEpisodes } from './iptv';
import {
  EpgProgram,
  MediaItem,
  PlaylistSource,
  WatchProgress,
} from './types';

const MiniLivePreview: React.FC<{
  item: MediaItem;
  epgTitle?: string;
  noProgramLabel: string;
  fullscreenLabel: string;
  onFullscreen: () => void;
}> = ({ item, epgTitle, noProgramLabel, fullscreenLabel, onFullscreen }) => {
  const player = useVideoPlayer(
    { uri: item.streamUrl, headers: { 'User-Agent': 'IPTVSmartersPlayer' } },
    (p) => {
      p.loop = false;
      p.play();
    }
  );

  useEffect(() => {
    player.replace({
      uri: item.streamUrl,
      headers: { 'User-Agent': 'IPTVSmartersPlayer' },
    });
    player.play();
  }, [item.streamUrl, player]);

  return (
    <View style={styles.rightPane}>
      <TouchableOpacity style={styles.miniVideoBox} onPress={onFullscreen}>
        <VideoView
          player={player}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          nativeControls={false}
        />
        <View style={styles.miniBar}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.fsBadge}>
            <Text style={styles.fsBadgeText}>{fullscreenLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.epgBox}>
        <Text style={styles.epgIcon}>📅</Text>
        <Text style={styles.epgText}>{epgTitle || noProgramLabel}</Text>
      </View>
    </View>
  );
};

interface Props {
  title: string;
  source: PlaylistSource | null;
  lang: AppLang;
  items: MediaItem[];
  epgMap: Record<string, EpgProgram>;
  favorites: MediaItem[];
  history: WatchProgress[];
  lockedCats: string[];
  loading: boolean;
  onChangeLang: (l: AppLang) => void;
  onPlayItem: (item: MediaItem, list: MediaItem[]) => void;
  onOpenMultiScreen: () => void;
  onOpenServer: () => void;
  onRefresh: () => void;
  onOpenSetPin: () => void;
  onToggleLockCat: (cat: string) => void;
}

export const MainScreen: React.FC<Props> = ({
  title,
  source,
  lang,
  items,
  epgMap,
  favorites,
  history,
  lockedCats,
  loading,
  onChangeLang,
  onPlayItem,
  onOpenMultiScreen,
  onOpenServer,
  onRefresh,
  onOpenSetPin,
  onToggleLockCat,
}) => {
  const t = TRANSLATIONS[lang];
  const [section, setSection] = useState<'live' | 'movie' | 'series' | 'settings'>('live');
  const [selectedCat, setSelectedCat] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<MediaItem | null>(null);
  const [episodesMap, setEpisodesMap] = useState<Record<string, MediaItem[]>>({});
  const [activeSeason, setActiveSeason] = useState<string>('');
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const sectionItems = useMemo(
    () => (section === 'settings' ? [] : items.filter((x) => x.type === section)),
    [items, section]
  );

  // تجميع كل حزمة/باقة مع عدد العناصر الموجودة بداخلها فقط
  const packages = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of sectionItems) {
      counts[it.category] = (counts[it.category] || 0) + 1;
    }
    const list = Object.keys(counts).map((cat) => ({
      name: cat,
      total: counts[cat],
      isFav: false,
    }));
    const favCount = favorites.filter((f) => f.type === section).length;
    return [{ name: t.myFavorites, total: favCount, isFav: true }, ...list];
  }, [sectionItems, favorites, section, t.myFavorites]);

  useEffect(() => {
    if (packages.length > 1) {
      setSelectedCat(packages[1].name);
    } else if (packages.length === 1) {
      setSelectedCat(packages[0].name);
    }
    setSelectedSeries(null);
    setEpisodesMap({});
  }, [section, items]);

  const displayedItems = useMemo(() => {
    const isFavCat = selectedCat === t.myFavorites;
    const base = isFavCat
      ? favorites.filter((f) => f.type === section)
      : sectionItems.filter((x) => x.category === selectedCat);
    if (!search.trim()) return base;
    return base.filter((x) =>
      x.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [selectedCat, t.myFavorites, favorites, section, sectionItems, search]);

  useEffect(() => {
    if (section === 'live' && displayedItems.length > 0) {
      if (!previewItem || previewItem.category !== selectedCat) {
        setPreviewItem(displayedItems[0]);
      }
    }
  }, [section, selectedCat, displayedItems]);

  const handleItemPress = async (item: MediaItem) => {
    if (section === 'live') {
      if (previewItem?.id === item.id) {
        onPlayItem(item, displayedItems);
      } else {
        setPreviewItem(item);
      }
      return;
    }

    if (section === 'movie') {
      if (previewItem?.id === item.id) {
        onPlayItem(item, displayedItems);
      } else {
        setPreviewItem(item);
      }
      return;
    }

    // المسلسلات
    if (item.streamUrl) {
      onPlayItem(item, displayedItems);
      return;
    }
    setSelectedSeries(item);
    if (source?.server && source.username && source.password && item.seriesId) {
      setLoadingEpisodes(true);
      const map = await fetchSeriesEpisodes(
        source.server,
        source.username,
        source.password,
        item
      );
      setEpisodesMap(map);
      const seasons = Object.keys(map);
      setActiveSeason(seasons[0] || '');
      setLoadingEpisodes(false);
    }
  };

  const allCategories = useMemo(
    () => Array.from(new Set(items.map((x) => x.category))),
    [items]
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* عمود 1: شريط الأيقونات الجانبي مثل Hot Player */}
      <View style={styles.iconRail}>
        <Text style={styles.brandBadge}>Z8</Text>

        {[
          { key: 'live', icon: '📺', label: t.live },
          { key: 'movie', icon: '🎬', label: t.movies },
          { key: 'series', icon: '🎞️', label: t.series },
        ].map((nav) => (
          <TouchableOpacity
            key={nav.key}
            style={[styles.railBtn, section === nav.key && styles.railBtnActive]}
            onPress={() => setSection(nav.key as any)}
          >
            <Text style={styles.railIcon}>{nav.icon}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.railBtn}
          onPress={() => setSelectedCat(t.myFavorites)}
        >
          <Text style={styles.railIcon}>❤️</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.railBtn} onPress={onOpenMultiScreen}>
          <Text style={styles.railIcon}>⊞</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.railBtn, searchOpen && styles.railBtnActive]}
          onPress={() => {
            setSearchOpen((s) => !s);
            setSearch('');
          }}
        >
          <Text style={styles.railIcon}>🔍</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.railBtn} onPress={onRefresh}>
          <Text style={styles.railIcon}>🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.railBtn} onPress={onOpenServer}>
          <Text style={styles.railIcon}>🌐</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.railBtn, section === 'settings' && styles.railBtnActive]}
          onPress={() => setSection('settings')}
        >
          <Text style={styles.railIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#C8E64C" />
          <Text style={styles.loadingText}>{t.loadingPlaylist}</Text>
        </View>
      ) : section === 'settings' ? (
        <ScrollView style={{ flex: 1, padding: 18 }}>
          <Text style={styles.sectionTitle}>{t.languageLabel}</Text>
          <View style={styles.rowGap}>
            {[
              { code: 'ar', label: 'العربية' },
              { code: 'fr', label: 'Français' },
              { code: 'en', label: 'English' },
            ].map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.pillBtn, lang === l.code && styles.pillActive]}
                onPress={() => onChangeLang(l.code as AppLang)}
              >
                <Text
                  style={[
                    styles.pillText,
                    lang === l.code && { color: '#0B132B', fontWeight: 'bold' },
                  ]}
                >
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.rowGap, { marginTop: 12 }]}>
            <TouchableOpacity style={styles.pillBtn} onPress={onRefresh}>
              <Text style={styles.pillText}>{t.refreshPlaylist}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pillBtn} onPress={onOpenSetPin}>
              <Text style={styles.pillText}>{t.setPin}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
            {t.lockCategories}
          </Text>
          {allCategories.map((cat) => (
            <View key={cat} style={styles.switchRow}>
              <Text style={{ color: '#FFF', flex: 1 }}>{cat}</Text>
              <Switch
                value={lockedCats.includes(cat)}
                onValueChange={() => onToggleLockCat(cat)}
              />
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.columnsWrap}>
          {/* عمود 2: الحزم والباقات مع Total */}
          <View style={styles.catCol}>
            <View style={styles.colHeader}>
              <Text style={styles.headerBrand}>{title}</Text>
            </View>
            <FlatList
              data={packages}
              keyExtractor={(p) => p.name}
              renderItem={({ item: pkg }) => {
                const active = selectedCat === pkg.name;
                return (
                  <TouchableOpacity
                    style={[styles.catCard, active && styles.activeLimeCard]}
                    onPress={() => setSelectedCat(pkg.name)}
                  >
                    <Text
                      style={[
                        styles.catTitle,
                        active && { color: '#0B132B', fontWeight: 'bold' },
                      ]}
                      numberOfLines={1}
                    >
                      {pkg.name}
                    </Text>
                    <Text
                      style={[
                        styles.catTotal,
                        active && { color: '#1E293B' },
                      ]}
                    >
                      {t.total}: {pkg.total}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* عمود 3: القنوات أو الأفلام أو المسلسلات داخل الحزمة المختارة */}
          <View style={styles.listCol}>
            <View style={styles.colHeader}>
              {searchOpen ? (
                <TextInput
                  style={styles.searchBox}
                  placeholder={t.searchPlaceholder}
                  placeholderTextColor="#94A3B8"
                  value={search}
                  onChangeText={setSearch}
                />
              ) : (
                <Text style={styles.colHeaderTitle} numberOfLines={1}>
                  {selectedCat}
                </Text>
              )}
            </View>

            <FlatList
              data={displayedItems}
              keyExtractor={(it) => it.id}
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              renderItem={({ item }) => {
                const isSelected =
                  section === 'series'
                    ? selectedSeries?.id === item.id
                    : previewItem?.id === item.id;
                const isLocked = lockedCats.includes(item.category);
                return (
                  <TouchableOpacity
                    style={[
                      styles.itemRow,
                      isSelected && styles.activeLimeCard,
                    ]}
                    onPress={() => handleItemPress(item)}
                  >
                    <Text style={styles.itemIcon}>
                      {isLocked
                        ? '🔒'
                        : section === 'live'
                        ? '📺'
                        : section === 'movie'
                        ? '🎬'
                        : '🎞️'}
                    </Text>
                    <Text
                      style={[
                        styles.itemName,
                        isSelected && { color: '#0B132B', fontWeight: 'bold' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.num !== undefined && (
                      <View style={styles.numBadge}>
                        <Text style={styles.numText}>{item.num}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* عمود 4: شاشة المعاينة و EPG أو تفاصيل الفيلم/المسلسل */}
          {section === 'live' && previewItem ? (
            <MiniLivePreview
              item={previewItem}
              epgTitle={epgMap[previewItem.epgId]?.title}
              noProgramLabel={t.noProgram}
              fullscreenLabel={t.fullscreen}
              onFullscreen={() => onPlayItem(previewItem, displayedItems)}
            />
          ) : section === 'movie' ? (
            <View style={styles.rightPane}>
              {previewItem ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>{previewItem.name}</Text>
                  <Text style={styles.infoCat}>{previewItem.category}</Text>
                  {previewItem.rating ? (
                    <Text style={styles.ratingText}>⭐ {previewItem.rating}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={styles.watchBtn}
                    onPress={() => onPlayItem(previewItem, displayedItems)}
                  >
                    <Text style={styles.watchBtnText}>{t.watchNow}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.rightPane}>
              {loadingEpisodes ? (
                <ActivityIndicator size="large" color="#C8E64C" />
              ) : selectedSeries ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle} numberOfLines={1}>
                    {selectedSeries.name}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ maxHeight: 40, marginVertical: 8 }}
                  >
                    {Object.keys(episodesMap).map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.seasonChip,
                          activeSeason === s && styles.activeLimeCard,
                        ]}
                        onPress={() => setActiveSeason(s)}
                      >
                        <Text
                          style={[
                            styles.seasonText,
                            activeSeason === s && { color: '#0B132B', fontWeight: 'bold' },
                          ]}
                        >
                          {t.season} {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <FlatList
                    data={episodesMap[activeSeason] || []}
                    keyExtractor={(ep) => ep.id}
                    renderItem={({ item: ep }) => (
                      <TouchableOpacity
                        style={styles.epRow}
                        onPress={() =>
                          onPlayItem(ep, episodesMap[activeSeason] || [])
                        }
                      >
                        <Text style={styles.epName} numberOfLines={1}>
                          ▶ {ep.name}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              ) : (
                <View style={styles.epgBox}>
                  <Text style={styles.epgText}>{t.selectSeriesHint}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#0B132B' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF', marginTop: 12 },
  iconRail: {
    width: 52,
    backgroundColor: '#080E21',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
    borderRightWidth: 1,
    borderColor: '#1E3A8A',
  },
  brandBadge: {
    color: '#C8E64C',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  railBtn: {
    width: 38,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#162447',
    justifyContent: 'center',
    alignItems: 'center',
  },
  railBtnActive: { backgroundColor: '#C8E64C' },
  railIcon: { fontSize: 16 },
  columnsWrap: { flex: 1, flexDirection: 'row' },
  catCol: {
    width: '26%',
    backgroundColor: '#0E1836',
    borderRightWidth: 1,
    borderColor: '#1E3A8A',
  },
  listCol: {
    width: '36%',
    backgroundColor: '#0B132B',
    borderRightWidth: 1,
    borderColor: '#1E3A8A',
  },
  rightPane: {
    flex: 1,
    backgroundColor: '#0B132B',
    padding: 10,
    justifyContent: 'space-between',
  },
  colHeader: {
    height: 40,
    backgroundColor: '#162447',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  headerBrand: { color: '#38BDF8', fontWeight: 'bold', fontSize: 15 },
  colHeaderTitle: { color: '#C8E64C', fontWeight: 'bold', fontSize: 13 },
  searchBox: {
    backgroundColor: '#0B132B',
    color: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
  },
  catCard: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#162447',
  },
  catTitle: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  catTotal: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
  activeLimeCard: { backgroundColor: '#C8E64C' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162447',
    marginHorizontal: 6,
    marginVertical: 3,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  itemIcon: { fontSize: 14 },
  itemName: { flex: 1, color: '#FFF', fontSize: 12 },
  numBadge: {
    backgroundColor: '#22D3EE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  numText: { color: '#0B132B', fontSize: 10, fontWeight: 'bold' },
  miniVideoBox: {
    height: '56%',
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  miniBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(14,116,144,0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  miniTitle: { flex: 1, color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  fsBadge: {
    backgroundColor: '#C8E64C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  fsBadgeText: { color: '#0B132B', fontSize: 10, fontWeight: 'bold' },
  epgBox: {
    flex: 1,
    marginTop: 8,
    backgroundColor: '#0E1836',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  epgIcon: { fontSize: 28, marginBottom: 6 },
  epgText: { color: '#CBD5E1', fontSize: 13, textAlign: 'center' },
  infoBox: {
    flex: 1,
    backgroundColor: '#0E1836',
    borderRadius: 10,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  infoCat: { color: '#38BDF8', fontSize: 12, marginTop: 4 },
  ratingText: { color: '#C8E64C', fontSize: 14, marginTop: 6 },
  watchBtn: {
    marginTop: 16,
    backgroundColor: '#C8E64C',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
  },
  watchBtnText: { color: '#0B132B', fontWeight: 'bold', fontSize: 14 },
  seasonChip: {
    backgroundColor: '#162447',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
  },
  seasonText: { color: '#FFF', fontSize: 12 },
  epRow: {
    backgroundColor: '#162447',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
  },
  epName: { color: '#FFF', fontSize: 12 },
  sectionTitle: { color: '#C8E64C', fontSize: 15, fontWeight: 'bold', marginBottom: 8 },
  rowGap: { flexDirection: 'row', gap: 10 },
  pillBtn: {
    flex: 1,
    backgroundColor: '#162447',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pillActive: { backgroundColor: '#C8E64C' },
  pillText: { color: '#FFF', fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#162447',
  },
});
