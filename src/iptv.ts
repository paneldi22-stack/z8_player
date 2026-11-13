import { EpgProgram, MediaItem, MediaType, SubtitleCue } from './types';

const IPTV_HEADERS = {
  'User-Agent': 'IPTVSmartersPlayer',
  Accept: '*/*',
};

function extractXtreamFromM3uUrl(
  url: string
): { server: string; username: string; password: string } | null {
  if (!url.toLowerCase().includes('get.php')) return null;
  const [base, query] = url.split('?');
  if (!query) return null;
  const server = base.replace(/\/get\.php$/i, '');
  const params: Record<string, string> = {};
  for (const part of query.split('&')) {
    const idx = part.indexOf('=');
    if (idx !== -1) {
      params[part.slice(0, idx).toLowerCase()] = decodeURIComponent(
        part.slice(idx + 1)
      );
    }
  }
  if (params.username && params.password) {
    return { server, username: params.username, password: params.password };
  }
  return null;
}

export function parseM3uContent(content: string): MediaItem[] {
  const lines = content.split(/\r?\n/);
  const items: MediaItem[] = [];

  let currentName = '';
  let currentLogo = '';
  let currentGroup = 'General';
  let currentEpgId = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentLogo = line.match(/tvg-logo="([^"]*)"/)?.[1] ?? '';
      currentGroup = line.match(/group-title="([^"]*)"/)?.[1] ?? 'General';
      currentEpgId = line.match(/tvg-id="([^"]*)"/)?.[1] ?? '';
      const commaIdx = line.lastIndexOf(',');
      currentName =
        commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : 'Channel';
    } else if (!line.startsWith('#')) {
      const lower = line.toLowerCase();
      const isSeries =
        lower.includes('/series/') || /s\d{1,2}\s*e\d{1,2}/i.test(currentName);
      const isMovie =
        !isSeries &&
        (lower.includes('/movie/') ||
          lower.endsWith('.mp4') ||
          lower.endsWith('.mkv') ||
          lower.endsWith('.avi'));

      const type: MediaType = isSeries ? 'series' : isMovie ? 'movie' : 'live';

      items.push({
        id: `${items.length}_${currentName}`,
        num: items.length + 1,
        name: currentName || `Stream ${items.length + 1}`,
        streamUrl: line,
        logoUrl: currentLogo,
        category: currentGroup || 'General',
        epgId: currentEpgId,
        type,
      });
      currentName = '';
    }
  }
  return items;
}

export async function fetchM3uUrl(url: string): Promise<MediaItem[]> {
  try {
    const res = await fetch(url, { headers: IPTV_HEADERS });
    if (!res.ok) throw new Error(`فشل تحميل القائمة (${res.status})`);
    const text = await res.text();
    const parsed = parseM3uContent(text);
    if (parsed.length === 0) throw new Error('القائمة فارغة أو الرابط غير صالح');
    return parsed;
  } catch (err) {
    const xtream = extractXtreamFromM3uUrl(url);
    if (xtream) {
      return fetchXtreamAccount(xtream.server, xtream.username, xtream.password);
    }
    throw err;
  }
}

export async function fetchXtreamAccount(
  serverUrl: string,
  username: string,
  password: string
): Promise<MediaItem[]> {
  const cleanServer = serverUrl.replace(/\/+$/, '');

  const fetchJson = async (action: string) => {
    const url = `${cleanServer}/player_api.php?username=${encodeURIComponent(
      username
    )}&password=${encodeURIComponent(password)}&action=${action}`;
    const res = await fetch(url, { headers: IPTV_HEADERS });
    if (!res.ok) throw new Error(`خطأ في السيرفر (${res.status})`);
    return res.json();
  };

  const [
    liveCatsRaw,
    vodCatsRaw,
    seriesCatsRaw,
    liveRaw,
    vodRaw,
    seriesRaw,
  ] = await Promise.all([
    fetchJson('get_live_categories').catch(() => []),
    fetchJson('get_vod_categories').catch(() => []),
    fetchJson('get_series_categories').catch(() => []),
    fetchJson('get_live_streams'),
    fetchJson('get_vod_streams').catch(() => []),
    fetchJson('get_series').catch(() => []),
  ]);

  const mapCats = (arr: any[]) => {
    const m: Record<string, string> = {};
    for (const c of arr || []) {
      if (c?.category_id) {
        m[String(c.category_id)] = String(c.category_name || 'General');
      }
    }
    return m;
  };

  const liveCatMap = mapCats(liveCatsRaw);
  const vodCatMap = mapCats(vodCatsRaw);
  const seriesCatMap = mapCats(seriesCatsRaw);

  const liveItems: MediaItem[] = (liveRaw || []).map(
    (item: any, idx: number) => {
      const id = String(item.stream_id);
      return {
        id: `live_${id}`,
        num: Number(item.num) || idx + 1,
        name: String(item.name || 'Channel'),
        streamUrl: `${cleanServer}/live/${username}/${password}/${id}.m3u8`,
        logoUrl: String(item.stream_icon || ''),
        category: liveCatMap[String(item.category_id)] || 'Live TV',
        epgId: String(item.epg_channel_id || ''),
        type: 'live',
      };
    }
  );

  const vodItems: MediaItem[] = (vodRaw || []).map(
    (item: any, idx: number) => {
      const id = String(item.stream_id);
      const ext = item.container_extension || 'mp4';
      return {
        id: `vod_${id}`,
        num: idx + 1,
        name: String(item.name || 'Movie'),
        streamUrl: `${cleanServer}/movie/${username}/${password}/${id}.${ext}`,
        logoUrl: String(item.stream_icon || ''),
        category: vodCatMap[String(item.category_id)] || 'Movies',
        epgId: '',
        type: 'movie',
        rating: item.rating ? String(item.rating) : undefined,
      };
    }
  );

  const seriesItems: MediaItem[] = (seriesRaw || []).map(
    (item: any, idx: number) => {
      const id = String(item.series_id);
      return {
        id: `series_${id}`,
        num: idx + 1,
        seriesId: id,
        name: String(item.name || 'Series'),
        streamUrl: '',
        logoUrl: String(item.cover || ''),
        category: seriesCatMap[String(item.category_id)] || 'Series',
        epgId: '',
        type: 'series',
        rating: item.rating ? String(item.rating) : undefined,
        plot: item.plot ? String(item.plot) : undefined,
      };
    }
  );

  return [...liveItems, ...vodItems, ...seriesItems];
}

export async function fetchSeriesEpisodes(
  serverUrl: string,
  username: string,
  password: string,
  seriesItem: MediaItem
): Promise<Record<string, MediaItem[]>> {
  const cleanServer = serverUrl.replace(/\/+$/, '');
  const url = `${cleanServer}/player_api.php?username=${encodeURIComponent(
    username
  )}&password=${encodeURIComponent(password)}&action=get_series_info&series_id=${
    seriesItem.seriesId
  }`;
  const res = await fetch(url, { headers: IPTV_HEADERS });
  if (!res.ok) return {};
  const data = await res.json();
  const episodesObj = data?.episodes || {};
  const result: Record<string, MediaItem[]> = {};

  for (const seasonKey of Object.keys(episodesObj)) {
    const epList = episodesObj[seasonKey] || [];
    result[seasonKey] = epList.map((ep: any, idx: number) => {
      const epId = String(ep.id);
      const ext = ep.container_extension || 'mp4';
      return {
        id: `ep_${epId}`,
        num: Number(ep.episode_num) || idx + 1,
        name: `${seriesItem.name} - S${seasonKey}E${ep.episode_num || idx + 1}`,
        streamUrl: `${cleanServer}/series/${username}/${password}/${epId}.${ext}`,
        logoUrl: seriesItem.logoUrl,
        category: seriesItem.category,
        epgId: '',
        type: 'series',
      };
    });
  }
  return result;
}

function parseXmltvDate(raw: string): number | null {
  const digits = raw.split(' ')[0];
  if (digits.length < 14) return null;
  return Date.UTC(
    Number(digits.slice(0, 4)),
    Number(digits.slice(4, 6)) - 1,
    Number(digits.slice(6, 8)),
    Number(digits.slice(8, 10)),
    Number(digits.slice(10, 12)),
    Number(digits.slice(12, 14))
  );
}

export async function fetchEpgMap(
  xmltvUrl?: string
): Promise<Record<string, EpgProgram>> {
  if (!xmltvUrl) return {};
  try {
    const res = await fetch(xmltvUrl, { headers: IPTV_HEADERS });
    if (!res.ok) return {};
    const xml = await res.text();
    const now = Date.now();
    const map: Record<string, EpgProgram> = {};
    const progRegex =
      /<programme[^>]*start="([^"]+)"[^>]*stop="([^"]+)"[^>]*channel="([^"]+)"[^>]*>([\s\S]*?)<\/programme>/g;
    let match: RegExpExecArray | null;

    while ((match = progRegex.exec(xml)) !== null) {
      const start = parseXmltvDate(match[1]);
      const end = parseXmltvDate(match[2]);
      const channelId = match[3];
      if (start && end && now >= start && now <= end) {
        const titleMatch = match[4].match(/<title[^>]*>([\s\S]*?)<\/title>/);
        const title = titleMatch
          ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
          : '';
        if (title) map[channelId] = { channelId, title, start, end };
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function parseSrtOrVtt(raw: string): SubtitleCue[] {
  const blocks = raw.replace(/\r/g, '').split(/\n\n+/);
  const cues: SubtitleCue[] = [];
  const toMs = (t: string): number => {
    const clean = t.trim().replace(',', '.');
    const parts = clean.split(':');
    if (parts.length === 3) {
      return (
        Number(parts[0]) * 3600000 +
        Number(parts[1]) * 60000 +
        parseFloat(parts[2]) * 1000
      );
    }
    if (parts.length === 2) {
      return Number(parts[0]) * 60000 + parseFloat(parts[1]) * 1000;
    }
    return 0;
  };

  for (const block of blocks) {
    const lines = block.split('\n');
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx !== -1) {
      const [startStr, endStr] = lines[timeLineIdx].split('-->');
      const text = lines
        .slice(timeLineIdx + 1)
        .join('\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      if (text) {
        cues.push({
          startMs: toMs(startStr),
          endMs: toMs(endStr.split(' ')[0]),
          text,
        });
      }
    }
  }
  return cues;
}
