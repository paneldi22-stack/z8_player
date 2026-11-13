import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { StorageService } from './storage';
import { ActiveSource } from './types';

interface Props {
  onSuccess: () => void;
}

export const LoginScreen: React.FC<Props> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'xtream' | 'm3u'>('xtream');

  // Xtream
  const [xtreamName, setXtreamName] = useState('My IPTV');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // M3U
  const [m3uName, setM3uName] = useState('M3U List');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');

  useEffect(() => {
    StorageService.getSource().then((src) => {
      if (!src) return;
      if (src.type === 'xtream') {
        setMode('xtream');
        setXtreamName(src.name);
        setServer(src.server || '');
        setUsername(src.username || '');
        setPassword(src.password || '');
      } else {
        setMode('m3u');
        setM3uName(src.name);
        setM3uUrl(src.m3uUrl || '');
        setEpgUrl(src.epgUrl || '');
        setFileName(src.fileName || '');
      }
    });
  }, []);

  const handleXtreamLogin = async () => {
    if (!server.trim() || !username.trim() || !password.trim()) {
      Alert.alert('تنبيه', 'عمر جميع خانات Xtream Codes');
      return;
    }
    const clean = server.trim().replace(/\/+$/, '');
    const fullServer = clean.startsWith('http') ? clean : `http://${clean}`;

    const source: ActiveSource = {
      type: 'xtream',
      name: xtreamName.trim() || 'Xtream IPTV',
      server: fullServer,
      username: username.trim(),
      password: password.trim(),
      epgUrl: `${fullServer}/xmltv.php?username=${username.trim()}&password=${password.trim()}`,
    };
    await StorageService.saveSource(source);
    onSuccess();
  };

  const handlePickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!res.canceled && res.assets?.[0]) {
      const asset = res.assets[0];
      const text = await fetch(asset.uri).then((r) => r.text());
      setFileName(asset.name);
      setFileContent(text);
      setM3uUrl('');
    }
  };

  const handleM3uLogin = async () => {
    if (!m3uUrl.trim() && !fileContent) {
      Alert.alert('تنبيه', 'حط رابط M3U أو اختار ملف من الهاتف');
      return;
    }
    const source: ActiveSource = {
      type: fileContent ? 'file' : 'm3u',
      name: m3uName.trim() || 'M3U Playlist',
      m3uUrl: m3uUrl.trim(),
      fileContent,
      fileName,
      epgUrl: epgUrl.trim(),
    };
    await StorageService.saveSource(source);
    onSuccess();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>Z8 PLAYER</Text>
        <Text style={styles.subtitle}>اختر طريقة إضافة القنوات والأفلام</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'xtream' && styles.activeTab]}
            onPress={() => setMode('xtream')}
          >
            <Text
              style={[
                styles.tabText,
                mode === 'xtream' && styles.activeTabText,
              ]}
            >
              Xtream Codes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'm3u' && styles.activeTab]}
            onPress={() => setMode('m3u')}
          >
            <Text
              style={[styles.tabText, mode === 'm3u' && styles.activeTabText]}
            >
              رابط / ملف M3U
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'xtream' ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="اسم الباقة (اختياري)"
              placeholderTextColor="#888"
              value={xtreamName}
              onChangeText={setXtreamName}
            />
            <TextInput
              style={styles.input}
              placeholder="Server URL (http://domain.com:8080)"
              placeholderTextColor="#888"
              autoCapitalize="none"
              value={server}
              onChangeText={setServer}
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#888"
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={styles.btn} onPress={handleXtreamLogin}>
              <Text style={styles.btnText}>دخول وتحميل القنوات</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="اسم القائمة"
              placeholderTextColor="#888"
              value={m3uName}
              onChangeText={setM3uName}
            />
            <TextInput
              style={styles.input}
              placeholder="رابط M3U / M3U8"
              placeholderTextColor="#888"
              autoCapitalize="none"
              value={m3uUrl}
              onChangeText={(t) => {
                setM3uUrl(t);
                setFileContent('');
                setFileName('');
              }}
            />
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={handlePickFile}
            >
              <Text style={styles.outlineBtnText}>
                {fileName ? `ملف مختار: ${fileName}` : 'أو اختر ملف M3U من الهاتف'}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="رابط EPG XMLTV (اختياري)"
              placeholderTextColor="#888"
              autoCapitalize="none"
              value={epgUrl}
              onChangeText={setEpgUrl}
            />
            <TouchableOpacity style={styles.btn} onPress={handleM3uLogin}>
              <Text style={styles.btnText}>تشغيل القائمة</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1117' },
  scroll: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F59E0B',
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1F242D',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#F59E0B' },
  tabText: { color: '#D1D5DB', fontWeight: '600' },
  activeTabText: { color: '#000', fontWeight: 'bold' },
  form: { gap: 14 },
  input: {
    backgroundColor: '#1A1F29',
    color: '#FFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2E3646',
  },
  btn: {
    backgroundColor: '#F59E0B',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  outlineBtnText: { color: '#F59E0B', fontWeight: '600' },
});
