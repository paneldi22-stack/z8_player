import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as Brightness from 'expo-brightness';
import * as DocumentPicker from 'expo-document-picker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { parseSrtOrVtt } from './iptv';
import { StorageService } from './storage';
import { MediaItem, SubtitleCue } from './types';

interface Props {
  item: MediaItem;
  onClose: () => void;
}

export const PlayerScreen: React.FC<Props> = ({ item, onClose }) => {
  const videoRef = useRef<Video>(null);
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN);
  const [rate, setRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [brightness, setBrightness] = useState(0.6);
  const [gestureText, setGestureText] = useState<string | null>(null);

  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState('');

  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const lastSavedSecRef = useRef(0);

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    ).catch(() => {});
    StorageService.isFavorite(item.streamUrl).then(setIsFav);
    Brightness.getBrightnessAsync()
      .then(setBrightness)
      .catch(() => {});

    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      ).catch(() => {});
    };
  }, [item]);

  const handleStatusUpdate = async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis);
    setDurationMs(status.durationMillis || 0);

    // عرض الترجمة المتزامنة
    if (cues.length > 0) {
      const current = cues.find(
        (c) =>
          status.positionMillis >= c.startMs && status.positionMillis <= c.endMs
      );
      setActiveSubtitle(current ? current.text : '');
    }

    // حفظ تقدم المشاهدة كل 5 ثواني
    const sec = Math.floor(status.positionMillis / 1000);
    if (sec - lastSavedSecRef.current >= 5) {
      lastSavedSecRef.current = sec;
      StorageService.saveProgress(
        item,
        status.positionMillis,
        status.durationMillis || 0
      );
    }
  };

  const handleLoad = async () => {
    if (item.type === 'movie') {
      const savedPos = await StorageService.getSavedPosition(item.streamUrl);
      if (savedPos > 5000) {
        await videoRef.current?.setPositionAsync(savedPos);
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12,
      onPanResponderMove: (evt, g) => {
        const width = Dimensions.get('window').width;
        const isLeft = evt.nativeEvent.pageX < width / 2;
        const delta = -g.dy / 3000;

        if (isLeft) {
          setBrightness((prev) => {
            const next = Math.min(1, Math.max(0.05, prev + delta));
            Brightness.setBrightnessAsync(next).catch(() => {});
            setGestureText(`الإضاءة: ${Math.round(next * 100)}%`);
            return next;
          });
        } else {
          setVolume((prev) => {
            const next = Math.min(1, Math.max(0, prev + delta));
            videoRef.current?.setVolumeAsync(next).catch(() => {});
            setGestureText(`الصوت: ${Math.round(next * 100)}%`);
            return next;
          });
        }
      },
      onPanResponderRelease: () => {
        setTimeout(() => setGestureText(null), 600);
      },
    })
  ).current;

  const handleScreenTap = (x: number) => {
    const now = Date.now();
    const width = Dimensions.get('window').width;
    if (now - lastTapRef.current.time < 300) {
      const isLeft = x < width / 2;
      const target = Math.max(0, positionMs + (isLeft ? -10000 : 10000));
      videoRef.current?.setPositionAsync(target);
      setGestureText(isLeft ? '-10 ثواني' : '+10 ثواني');
      setTimeout(() => setGestureText(null), 700);
    } else {
      setShowControls((s) => !s);
    }
    lastTapRef.current = { time: now, x };
  };

  const loadSubtitleFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!res.canceled && res.assets?.[0]) {
      const text = await fetch(res.assets[0].uri).then((r) => r.text());
      setCues(parseSrtOrVtt(text));
    }
  };

  const cycleResize = () => {
    setResizeMode((prev) =>
      prev === ResizeMode.CONTAIN
        ? ResizeMode.COVER
        : prev === ResizeMode.COVER
        ? ResizeMode.STRETCH
        : ResizeMode.CONTAIN
    );
  };

  const cycleRate = async () => {
    const next = rate === 1.0 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 2.0 : 1.0;
    setRate(next);
    await videoRef.current?.setRateAsync(next, true);
  };

  return (
    <View
      style={styles.container}
      {...panResponder.panHandlers}
      onTouchEnd={(e) => handleScreenTap(e.nativeEvent.pageX)}
    >
      <Video
        ref={videoRef}
        source={{ uri: item.streamUrl }}
        style={styles.video}
        resizeMode={resizeMode}
        shouldPlay
        onLoad={handleLoad}
        onPlaybackStatusUpdate={handleStatusUpdate}
      />

      {activeSubtitle ? (
        <View style={styles.subBox}>
          <Text style={styles.subText}>{activeSubtitle}</Text>
        </View>
      ) : null}

      {gestureText ? (
        <View style={styles.gestureBadge}>
          <Text style={styles.gestureBadgeText}>{gestureText}</Text>
        </View>
      ) : null}

      {showControls && (
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Text style={styles.btnLabel}>رجوع ✕</Text>
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
              {item.name}
            </Text>
            <TouchableOpacity
              onPress={async () => {
                const state = await StorageService.toggleFavorite(item);
                setIsFav(state);
              }}
              style={styles.iconBtn}
            >
              <Text style={styles.btnLabel}>{isFav ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={loadSubtitleFile} style={styles.iconBtn}>
              <Text style={styles.btnLabel}>CC ترجمة</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cycleResize} style={styles.iconBtn}>
              <Text style={styles.btnLabel}>الأبعاد</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cycleRate} style={styles.iconBtn}>
              <Text style={styles.btnLabel}>{rate}x</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.centerControls}>
            <TouchableOpacity
              style={styles.playBtn}
              onPress={() =>
                isPlaying
                  ? videoRef.current?.pauseAsync()
                  : videoRef.current?.playAsync()
              }
            >
              <Text style={styles.playBtnText}>
                {isPlaying ? 'إيقاف ❚❚' : 'تشغيل ▶'}
              </Text>
            </TouchableOpacity>
          </View>

          {durationMs > 0 && (
            <View style={styles.bottomBar}>
              <Text style={styles.timeText}>
                {Math.floor(positionMs / 60000)}:
                {String(Math.floor((positionMs % 60000) / 1000)).padStart(2, '0')}{' '}
                / {Math.floor(durationMs / 60000)}:
                {String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0')}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'space-between',
    padding: 16,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  iconBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnLabel: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  centerControls: { alignItems: 'center' },
  playBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  playBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  bottomBar: { alignItems: 'center' },
  timeText: { color: '#FFF', fontSize: 13 },
  gestureBadge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  gestureBadgeText: { color: '#F59E0B', fontSize: 18, fontWeight: 'bold' },
  subBox: {
    position: 'absolute',
    bottom: 45,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subText: { color: '#FFF', fontSize: 16, textAlign: 'center' },
});
