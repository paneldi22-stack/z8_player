import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  FlatList,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useVideoPlayer, VideoContentFit, VideoView } from 'expo-video';
import * as Brightness from 'expo-brightness';
import * as DocumentPicker from 'expo-document-picker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AppLang, TRANSLATIONS } from './i18n';
import { parseSrtOrVtt } from './iptv';
import { StorageService } from './storage';
import { MediaItem, SubtitleCue } from './types';

interface Props {
  item: MediaItem;
  channelList?: MediaItem[];
  lang: AppLang;
  onSelectChannel?: (next: MediaItem) => void;
  onClose: () => void;
}

export const PlayerScreen: React.FC<Props> = ({
  item,
  channelList = [],
  lang,
  onSelectChannel,
  onClose,
}) => {
  const t = TRANSLATIONS[lang];
  const videoViewRef = useRef<VideoView>(null);
  const player = useVideoPlayer(
    {
      uri: item.streamUrl,
      headers: { 'User-Agent': 'IPTVSmartersPlayer' },
    },
    (p) => {
      p.loop = false;
      p.play();
    }
  );

  const [showControls, setShowControls] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [contentFit, setContentFit] = useState<VideoContentFit>('contain');
  const [rate, setRate] = useState(1.0);
  const [brightness, setBrightness] = useState(0.6);
  const [gestureText, setGestureText] = useState<string | null>(null);

  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState('');

  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const restoredRef = useRef(false);
  const lastSavedSecRef = useRef(0);
  const initialUrlRef = useRef(item.streamUrl);

  // تبديل البث فوراً عند تغيير القناة داخل المشغل
  useEffect(() => {
    if (item.streamUrl !== initialUrlRef.current) {
      initialUrlRef.current = item.streamUrl;
      restoredRef.current = false;
      setIsBuffering(true);
      setErrorMsg(null);
      player.replace({
        uri: item.streamUrl,
        headers: { 'User-Agent': 'IPTVSmartersPlayer' },
      });
      player.play();
    }
    StorageService.isFavorite(item.streamUrl).then(setIsFav);
  }, [item, player]);

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    ).catch(() => {});
    Brightness.getBrightnessAsync()
      .then(setBrightness)
      .catch(() => {});

    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      onClose();
      return true;
    });

    const statusSub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'loading') {
        setIsBuffering(true);
        setErrorMsg(null);
      } else if (status === 'readyToPlay') {
        setIsBuffering(false);
        setErrorMsg(null);
      } else if (status === 'error') {
        setIsBuffering(false);
        setErrorMsg(error?.message || t.serverConnectError);
      }
    });

    return () => {
      backSub.remove();
      statusSub.remove();
    };
  }, [drawerOpen, onClose, player, t.serverConnectError]);

  useEffect(() => {
    const timer = setInterval(async () => {
      const cur = player.currentTime || 0;
      const dur = player.duration || 0;
      setPositionSec(cur);
      setDurationSec(dur);
      setIsPlaying(player.playing);

      if (!restoredRef.current && dur > 0 && item.type !== 'live') {
        restoredRef.current = true;
        const savedMs = await StorageService.getSavedPosition(item.streamUrl);
        if (savedMs > 5000) player.currentTime = savedMs / 1000;
      }

      if (cues.length > 0) {
        const curMs = cur * 1000;
        const found = cues.find((c) => curMs >= c.startMs && curMs <= c.endMs);
        setActiveSubtitle(found ? found.text : '');
      }

      const wholeSec = Math.floor(cur);
      if (wholeSec - lastSavedSecRef.current >= 5) {
        lastSavedSecRef.current = wholeSec;
        StorageService.saveProgress(item, cur * 1000, dur * 1000);
      }
    }, 300);

    return () => clearInterval(timer);
  }, [player, cues, item]);

  const switchRelative = (step: number) => {
    if (!onSelectChannel || channelList.length < 2) return;
    const idx = channelList.findIndex((c) => c.id === item.id);
    if (idx === -1) return;
    const nextIdx = (idx + step + channelList.length) % channelList.length;
    onSelectChannel(channelList[nextIdx]);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !drawerOpen && Math.abs(g.dy) > 14,
      onPanResponderMove: (evt, g) => {
        const width = Dimensions.get('window').width;
        const isLeft = evt.nativeEvent.pageX < width / 2;
        const delta = -g.dy / 3000;

        if (isLeft) {
          setBrightness((prev) => {
            const next = Math.min(1, Math.max(0.05, prev + delta));
            Brightness.setBrightnessAsync(next).catch(() => {});
            setGestureText(`${t.brightness}: ${Math.round(next * 100)}%`);
            return next;
          });
        } else {
          const nextVol = Math.min(1, Math.max(0, (player.volume ?? 1) + delta));
          player.volume = nextVol;
          setGestureText(`${t.volume}: ${Math.round(nextVol * 100)}%`);
        }
      },
      onPanResponderRelease: () => {
        setTimeout(() => setGestureText(null), 600);
      },
    })
  ).current;

  const handleScreenTap = (x: number) => {
    if (drawerOpen) return;
    const now = Date.now();
    const width = Dimensions.get('window').width;
    if (now - lastTapRef.current.time < 300) {
      const isLeft = x < width / 2;
      player.currentTime = Math.max(0, player.currentTime + (isLeft ? -10 : 10));
      setGestureText(isLeft ? `-10 ${t.sec}` : `+10 ${t.sec}`);
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

  const cycleFit = () => {
    setContentFit((prev) =>
      prev === 'contain' ? 'cover' : prev === 'cover' ? 'fill' : 'contain'
    );
  };

  const cycleRate = () => {
    const next =
      rate === 1.0 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 2.0 : 1.0;
    setRate(next);
    player.playbackRate = next;
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <View
      style={styles.container}
      {...panResponder.panHandlers}
      onTouchEnd={(e) => handleScreenTap(e.nativeEvent.pageX)}
    >
      <VideoView
        ref={videoViewRef}
        player={player}
        style={styles.video}
        contentFit={contentFit}
        nativeControls={false}
        allowsPictureInPicture
      />

      {isBuffering && !errorMsg && (
        <View style={styles.centerStatus}>
          <ActivityIndicator size="large" color="#C8E64C" />
        </View>
      )}

      {errorMsg && (
        <View style={styles.centerStatus}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setErrorMsg(null);
              setIsBuffering(true);
              player.replace({
                uri: item.streamUrl,
                headers: { 'User-Agent': 'IPTVSmartersPlayer' },
              });
              player.play();
            }}
          >
            <Text style={styles.retryText}>{t.retry}</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {showControls && !drawerOpen && (
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Text style={styles.btnLabel}>{t.back}</Text>
            </TouchableOpacity>
            {channelList.length > 0 && (
              <TouchableOpacity
                onPress={() => setDrawerOpen(true)}
                style={[styles.iconBtn, { backgroundColor: '#C8E64C' }]}
              >
                <Text style={{ color: '#0B132B', fontWeight: 'bold', fontSize: 12 }}>
                  ☰ {t.channelList}
                </Text>
              </TouchableOpacity>
            )}
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
            <TouchableOpacity
              onPress={() => videoViewRef.current?.startPictureInPicture()}
              style={styles.iconBtn}
            >
              <Text style={styles.btnLabel}>PiP</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={loadSubtitleFile} style={styles.iconBtn}>
              <Text style={styles.btnLabel}>CC</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cycleFit} style={styles.iconBtn}>
              <Text style={styles.btnLabel}>{t.aspect}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cycleRate} style={styles.iconBtn}>
              <Text style={styles.btnLabel}>{rate}x</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.centerControls}>
            {channelList.length > 1 && (
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => switchRelative(-1)}
              >
                <Text style={styles.switchBtnText}>⏮</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.playBtn}
              onPress={() => (isPlaying ? player.pause() : player.play())}
            >
              <Text style={styles.playBtnText}>
                {isPlaying ? t.pause : t.play}
              </Text>
            </TouchableOpacity>
            {channelList.length > 1 && (
              <TouchableOpacity
                style={styles.switchBtn}
                onPress={() => switchRelative(1)}
              >
                <Text style={styles.switchBtnText}>⏭</Text>
              </TouchableOpacity>
            )}
          </View>

          {durationSec > 0 ? (
            <View style={styles.bottomBar}>
              <Text style={styles.timeText}>
                {formatTime(positionSec)} / {formatTime(durationSec)}
              </Text>
            </View>
          ) : (
            <View />
          )}
        </View>
      )}

      {drawerOpen && (
        <View style={styles.drawer}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>{t.channelList}</Text>
            <TouchableOpacity onPress={() => setDrawerOpen(false)}>
              <Text style={{ color: '#C8E64C', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={channelList}
            keyExtractor={(c) => c.id}
            renderItem={({ item: ch }) => {
              const active = ch.id === item.id;
              return (
                <TouchableOpacity
                  style={[styles.drawerRow, active && styles.drawerRowActive]}
                  onPress={() => {
                    onSelectChannel?.(ch);
                    setDrawerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.drawerRowText,
                      active && { color: '#0B132B', fontWeight: 'bold' },
                    ]}
                    numberOfLines={1}
                  >
                    {ch.num ? `${ch.num}  ` : ''}
                    {ch.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  centerStatus: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(11,19,43,0.9)',
    padding: 18,
    borderRadius: 12,
    maxWidth: '80%',
  },
  errorText: { color: '#EF4444', textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: '#C8E64C',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: '#0B132B', fontWeight: 'bold' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'space-between',
    padding: 16,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  iconBtn: {
    backgroundColor: 'rgba(11,19,43,0.75)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnLabel: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  switchBtn: {
    backgroundColor: 'rgba(11,19,43,0.8)',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E64C',
  },
  switchBtnText: { color: '#C8E64C', fontSize: 18, fontWeight: 'bold' },
  playBtn: {
    backgroundColor: '#C8E64C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  playBtnText: { color: '#0B132B', fontWeight: 'bold', fontSize: 16 },
  bottomBar: { alignItems: 'center' },
  timeText: { color: '#FFF', fontSize: 13 },
  gestureBadge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(11,19,43,0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  gestureBadgeText: { color: '#C8E64C', fontSize: 18, fontWeight: 'bold' },
  subBox: {
    position: 'absolute',
    bottom: 45,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subText: { color: '#FFF', fontSize: 16, textAlign: 'center' },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    backgroundColor: 'rgba(11,19,43,0.95)',
    borderRightWidth: 1,
    borderColor: '#1E3A8A',
    padding: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#1E3A8A',
    marginBottom: 8,
  },
  drawerTitle: { color: '#C8E64C', fontWeight: 'bold', fontSize: 15 },
  drawerRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#162447',
  },
  drawerRowActive: { backgroundColor: '#C8E64C' },
  drawerRowText: { color: '#FFF', fontSize: 13 },
});
