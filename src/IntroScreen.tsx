import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface Props {
  onFinish: () => void;
}

export const IntroScreen: React.FC<Props> = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.75)).current;
  const barScaleX = useRef(new Animated.Value(0.05)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 45,
        useNativeDriver: true,
      }),
      Animated.timing(barScaleX, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 2400);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, barScaleX, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.logoRing}>
          <View style={styles.logoInner}>
            <Text style={styles.logoText}>Z8</Text>
          </View>
        </View>

        <Text style={styles.title}>Z8 PLAYER</Text>
        <Text style={styles.subtitle}>LIVE TV • MOVIES • ULTRA HD</Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { transform: [{ scaleX: barScaleX }] },
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '80%',
  },
  logoRing: {
    width: 124,
    height: 124,
    borderRadius: 34,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  logoInner: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#090D16',
    letterSpacing: -1,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: 32,
  },
  progressTrack: {
    width: 180,
    height: 4,
    backgroundColor: '#1E2536',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F59E0B',
  },
});
