import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MediaItem } from './types';

interface CellProps {
  item: MediaItem;
  isAudio: boolean;
  onSwap: () => void;
}

const MultiVideoCell: React.FC<CellProps> = ({ item, isAudio, onSwap }) => {
  const player = useVideoPlayer(item.streamUrl, (p) => {
    p.muted = !isAudio;
    p.play();
  });

  useEffect(() => {
    player.muted = !isAudio;
  }, [isAudio, player]);

  return (
    <>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />
      <View style={styles.cellOverlay}>
        <Text style={styles.cellName} numberOfLines={1}>
          {isAudio ? '🔊' : '🔇'} {item.name}
        </Text>
        <TouchableOpacity style={styles.swapBtn} onPress={onSwap}>
          <Text style={styles.swapText}>تغيير</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

interface Props {
  channels: MediaItem[];
  onClose: () => void;
}

export const MultiScreen: React.FC<Props> = ({ channels, onClose }) => {
  const [slots, setSlots] = useState<(MediaItem | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [activeAudio, setActiveAudio] = useState(0);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);

  const assignChannel = (item: MediaItem) => {
    if (pickingSlot === null) return;
    const updated = [...slots];
    updated[pickingSlot] = item;
    setSlots(updated);
    setPickingSlot(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>تعدد الشاشات (4 قنوات)</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>إغلاق ✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {slots.map((item, idx) => {
          const isAudio = activeAudio === idx;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.cell, isAudio && styles.activeCell]}
              onPress={() => setActiveAudio(idx)}
            >
              {item ? (
                <MultiVideoCell
                  key={item.streamUrl}
                  item={item}
                  isAudio={isAudio}
                  onSwap={() => setPickingSlot(idx)}
                />
              ) : (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setPickingSlot(idx)}
                >
                  <Text style={styles.addText}>+ شاشة {idx + 1}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={pickingSlot !== null} animationType="slide">
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>اختر قناة</Text>
            <TouchableOpacity onPress={() => setPickingSlot(null)}>
              <Text style={styles.closeText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={channels}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listItem}
                onPress={() => assignChannel(item)}
              >
                <Text style={styles.listTitle}>{item.name}</Text>
                <Text style={styles.listCat}>{item.category}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#161B22',
  },
  headerTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  closeBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closeText: { color: '#FFF', fontWeight: 'bold' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '50%',
    height: '50%',
    borderWidth: 1.5,
    borderColor: '#2D333B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCell: { borderColor: '#F59E0B' },
  video: { width: '100%', height: '100%' },
  cellOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 6,
  },
  cellName: { color: '#FFF', fontSize: 11, flex: 1 },
  swapBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 6, borderRadius: 4 },
  swapText: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#1F242D', padding: 14, borderRadius: 8 },
  addText: { color: '#F59E0B', fontWeight: 'bold' },
  modal: { flex: 1, backgroundColor: '#0E1117' },
  listItem: { padding: 14, borderBottomWidth: 1, borderColor: '#1F242D' },
  listTitle: { color: '#FFF', fontSize: 15 },
  listCat: { color: '#888', fontSize: 12 },
});
