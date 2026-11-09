import React, { useEffect, useState } from 'react';
import { BackHandler, StatusBar, View } from 'react-native';
import { AppProvider } from './src/app/AppContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AddM3u, AddMethod, AddXtream, Home, LivePlayer, LiveTv, Playlists, Stub, Sync, Welcome, type Nav, type Route } from './src/screens/screens';

function Router() {
  const { colors, scheme } = useTheme();
  const [stack, setStack] = useState<Route[]>([{ name: 'welcome' }]);
  const nav: Nav = {
    go: (r) => setStack((s) => [...s, r]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) { nav.back(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  const r = stack[stack.length - 1]!;
  const screen = (() => {
    switch (r.name) {
      case 'welcome': return <Welcome nav={nav} />;
      case 'playlists': return <Playlists nav={nav} />;
      case 'addMethod': return <AddMethod nav={nav} />;
      case 'addXtream': return <AddXtream nav={nav} />;
      case 'addM3u': return <AddM3u nav={nav} prefill={r.prefill} />;
      case 'sync': return <Sync nav={nav} playlistId={r.playlistId} />;
      case 'home': return <Home nav={nav} playlistId={r.playlistId} />;
      case 'live': return <LiveTv nav={nav} playlistId={r.playlistId} />;
      case 'player': return <LivePlayer nav={nav} playlistId={r.playlistId} channelId={r.channelId} list={r.list} />;
      case 'stub': return <Stub nav={nav} title={r.title} />;
    }
  })();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {screen}
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <Router />
      </AppProvider>
    </ThemeProvider>
  );
}
