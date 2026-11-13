export type MediaType = 'live' | 'movie' | 'series';

export interface MediaItem {
  id: string;
  num?: number;
  name: string;
  streamUrl: string;
  logoUrl: string;
  category: string;
  epgId: string;
  type: MediaType;
  seriesId?: string;
  rating?: string;
  plot?: string;
}

export interface PlaylistSource {
  type: 'xtream' | 'm3u' | 'file';
  name: string;
  server?: string;
  username?: string;
  password?: string;
  m3uUrl?: string;
  fileContent?: string;
  epgUrl?: string;
}

export interface EpgProgram {
  channelId: string;
  title: string;
  start: number;
  end: number;
}

export interface WatchProgress {
  item: MediaItem;
  positionMs: number;
  durationMs: number;
  updatedAt: number;
}

export interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
}
