import React, { useState } from 'react';
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
import { AppLang, TRANSLATIONS } from './i18n';
import { StorageService } from './storage';

interface Props {
  lang: AppLang;
  onChangeLang: (l: AppLang) => void;
  onSuccess: () => void;
}

export const LoginScreen: React.FC<Props> = ({
  lang,
  onChangeLang,
  onSuccess,
}) => {
  const t = TRANSLATIONS[lang];
  const [mode, setMode] = useState<'xtream' | 'm3u' | 'file'>('xtream');
  const [name, setName] = useState('Z8 IPTV');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');

  const handlePickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!res.canceled && res.assets?.[0]) {
      const asset = res.assets[0];
      const text = await fetch(asset.uri).then((r) => r.text());
      setFileName(asset.name);
      setFileContent(text);
    }
  };

  const handleSave = async () => {
    if (mode === 'xtream') {
      if (!server.trim() || !username.trim() || !password.trim()) {
        Alert.alert(t.error, t.fillRequired);
        return;
      }
      await StorageService.saveSource({
        type: 'xtream',
        name: name.trim() || 'Z8 IPTV',
        server: server.trim(),
        username: username.trim(),
        password: password.trim(),
        epgUrl: epgUrl.trim() || undefined,
      });
    } else if (mode === 'm3u') {
      if (!m3uUrl.trim()) {
        Alert.alert(t.error, t.fillRequired);
        return;
      }
      await StorageService.saveSource({
        type: 'm3u',
        name: name.trim() || 'Z8 M3U',
        m3uUrl: m3uUrl.trim(),
        epgUrl: epgUrl.trim() || undefined,
      });
    } else {
      if (!fileContent) {
        Alert.alert(t.error, t.fillRequired);
        return;
      }
      await StorageService.saveSource({
        type: 'file',
        name: name.trim() || fileName || 'Local M3U',
        fileContent,
        epgUrl: epgUrl.trim() || undefined,
      });
    }
    onSuccess();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{t.loginTitle}</Text>
          <View style={styles.langRow}>
            {(['ar', 'fr', 'en'] as AppLang[]).map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.langBtn, lang === l && styles.langBtnActive]}
                onPress={() => onChangeLang(l)}
              >
                <Text
                  style={[
                    styles.langText,
                    lang === l && { color: '#000', fontWeight: 'bold' },
                  ]}
                >
                  {l === 'ar' ? 'العربية' : l === 'fr' ? 'FR' : 'EN'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.tabs}>
          {[
            { key: 'xtream', label: 'Xtream Codes' },
            { key: 'm3u', label: 'M3U URL' },
            { key: 'file', label: 'M3U File' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.tab, mode === item.key && styles.activeTab]}
              onPress={() => setMode(item.key as any)}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === item.key && { color: '#000', fontWeight: 'bold' },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.gridForm}>
          <TextInput
            style={styles.input}
            placeholder={t.playlistName}
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
          />

          {mode === 'xtream' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder={t.serverUrl}
                placeholderTextColor="#888"
                autoCapitalize="none"
                value={server}
                onChangeText={setServer}
              />
              <TextInput
                style={styles.input}
                placeholder={t.username}
                placeholderTextColor="#888"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
              />
              <TextInput
                style={styles.input}
                placeholder={t.password}
                placeholderTextColor="#888"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </>
          ) : mode === 'm3u' ? (
            <TextInput
              style={styles.input}
              placeholder={t.m3uUrl}
              placeholderTextColor="#888"
              autoCapitalize="none"
              value={m3uUrl}
              onChangeText={setM3uUrl}
            />
          ) : (
            <TouchableOpacity style={styles.fileBtn} onPress={handlePickFile}>
              <Text style={styles.fileBtnText}>
                {fileName ? `${t.fileSelected} ${fileName}` : t.pickM3uFile}
              </Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={styles.input}
            placeholder={t.epgUrl}
            placeholderTextColor="#888"
            autoCapitalize="none"
            value={epgUrl}
            onChangeText={setEpgUrl}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{t.connectBtn}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1117' },
  scroll: { padding: 18, maxWidth: 680, width: '100%', alignSelf: 'center' },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: { color: '#F59E0B', fontSize: 20, fontWeight: 'bold' },
  langRow: { flexDirection: 'row', gap: 6 },
  langBtn: {
    backgroundColor: '#1F242D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  langBtnActive: { backgroundColor: '#F59E0B' },
  langText: { color: '#FFF', fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: {
    flex: 1,
    backgroundColor: '#161B22',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: { backgroundColor: '#F59E0B' },
  tabText: { color: '#CCC', fontSize: 13 },
  gridForm: { gap: 10 },
  input: {
    backgroundColor: '#161B22',
    color: '#FFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  fileBtn: {
    backgroundColor: '#1F242D',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  fileBtnText: { color: '#F59E0B', fontWeight: 'bold' },
  saveBtn: {
    backgroundColor: '#F59E0B',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
