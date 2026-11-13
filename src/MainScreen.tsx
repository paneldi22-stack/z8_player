import React, { useState } from 'react';
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
import { AppLang, TRANSLATIONS } from './i18n';
import { EpgProgram, MediaItem, WatchProgress } from './types';

interface Props {
  title: string;
  lang: AppLang;
  items: MediaItem[];
  epgMap: Record<string, EpgProgram>;
  favorites: MediaItem[];
  history: WatchProgress[];
  lockedCats: string[];
  loading: boolean;
  onChangeLang: (l: AppLang) => void;
  onSelectItem: (item: MediaItem) => void;
  onOpenMultiScreen: () => void;
  onOpenServer: () => void;
  onRefresh: () => void;
  onOpenSetPin: () => void;
  onToggleLockCat: (cat: string) => void;
}

export const MainScreen: React.FC<Props> = ({
  title,
  lang,
  items,
  epgMap,
  favorites,
  history,
  lockedCats,
  loading,
  onChangeLang,
  onSelectItem,
  onOpenMultiScreen,
  onOpenServer,
  onRefresh,
  onOpenSetPin,
  onToggleLockCat,
}) => {
  const t = TRANSLATIONS[lang];
  const [tab, setTab] = useState<'live' | 'movie' | 'fav' | 'settings'>('live');
  const [selectedCat, setSelectedCat] = useState('All');
  const [search, setSearch] = useState('');

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
          <TouchableOpacity style={styles.topBtn} onPress={onOpenMultiScreen}>
            <Text style={styles.topBtnText}>{t.multiScreen}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBtn} onPress={onOpenServer}>
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
                  onPress={() => onSelectItem(item)}
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
              onPress={() => onSelectItem(h.item)}
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
              onPress={() => onSelectItem(f)}
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
                onPress={() => onChangeLang(item.code as AppLang)}
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
            <TouchableOpacity style={styles.actionBtn} onPress={onRefresh}>
              <Text style={styles.actionBtnText}>{t.refreshPlaylist}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={onOpenSetPin}>
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
                onValueChange={() => onToggleLockCat(cat)}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1117' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
});
