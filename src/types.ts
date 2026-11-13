export type MediaType = 'live' | 'movie';

export interface MediaItem {
  id: string;
  name: string;
  streamUrl: string;
  logoUrl: string;
  category: string;
  epgId: string;
  type: MediaType;
}

export interface EpgProgram {
  channelId: string;
  title: string;
  start: number;
  end: number;
}

export interface WatchProgress {
  item: MediaItem;
  positionMillis: number;
  durationMillis: number;
}

export interface ActiveSource {
  type: 'xtream' | 'm3u' | 'file';
  name: string;
  server?: string;
  username?: string;
  password?: string;
  m3uUrl?: string;
  fileContent?: string;
  fileName?: string;
  epgUrl?: string;
}

export interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
}
