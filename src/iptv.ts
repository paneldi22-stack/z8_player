import { EpgProgram, MediaItem, SubtitleCue } from './types';

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
      const k = part.slice(0, idx).toLowerCase();
      const v = part.slice(idx + 1);
      params[k] = decodeURIComponent(v);
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
      const isMovie =
        lower.endsWith('.mp4') ||
        lower.endsWith('.mkv') ||
        lower.endsWith('.avi');

      items.push({
        id: `${items.length}_${currentName}`,
        name: currentName || `Stream ${items.length + 1}`,
        streamUrl: line,
        logoUrl: currentLogo,
        category: currentGroup || 'General',
        epgId: currentEpgId,
        type: isMovie ? 'movie' : 'live',
      });
      currentName = '';
    }
  }
  return items;
}

export async function fetchM3uUrl(url: string): Promise<MediaItem[]> {
  try {
    const res = await fetch(url, { headers: IPTV_HEADERS });
    if (!res.ok) {
      throw new Error(`فشل تحميل القائمة (${res.status})`);
    }
    const text = await res.text();
    const parsed = parseM3uContent(text);
    if (parsed.length === 0) {
      throw new Error('القائمة فارغة أو الرابط غير صالح');
    }
    return parsed;
  } catch (err) {
    // إذا كان الرابط get.php وعطى 504 أو تعطل، نبدلو تلقائياً لـ Xtream API الأسرع
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

  const [liveCatsRaw, vodCatsRaw, liveRaw, vodRaw] = await Promise.all([
    fetchJson('get_live_categories').catch(() => []),
    fetchJson('get_vod_categories').catch(() => []),
    fetchJson('get_live_streams'),
    fetchJson('get_vod_streams').catch(() => []),
  ]);

  const catMap: Record<string, string> = {};
  for (const c of [...(liveCatsRaw || []), ...(vodCatsRaw || [])]) {
    if (c?.category_id) {
      catMap[String(c.category_id)] = String(c.category_name || 'General');
    }
  }

  const liveItems: MediaItem[] = (liveRaw || []).map((item: any) => {
    const id = String(item.stream_id);
    return {
      id: `live_${id}`,
      name: String(item.name || 'Channel'),
      streamUrl: `${cleanServer}/live/${username}/${password}/${id}.m3u8`,
      logoUrl: String(item.stream_icon || ''),
      category: catMap[String(item.category_id)] || 'Live TV',
      epgId: String(item.epg_channel_id || ''),
      type: 'live',
    };
  });

  const vodItems: MediaItem[] = (vodRaw || []).map((item: any) => {
    const id = String(item.stream_id);
    const ext = item.container_extension || 'mp4';
    return {
      id: `vod_${id}`,
      name: String(item.name || 'Movie'),
      streamUrl: `${cleanServer}/movie/${username}/${password}/${id}.${ext}`,
      logoUrl: String(item.stream_icon || ''),
      category: catMap[String(item.category_id)] || 'Movies',
      epgId: '',
      type: 'movie',
    };
  });

  return [...liveItems, ...vodItems];
}

function parseXmltvDate(raw: string): number | null {
  const digits = raw.split(' ')[0];
  if (digits.length < 14) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6)) - 1;
  const day = Number(digits.slice(6, 8));
  const hour = Number(digits.slice(8, 10));
  const min = Number(digits.slice(10, 12));
  const sec = Number(digits.slice(12, 14));
  return Date.UTC(year, month, day, hour, min, sec);
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
        if (title) {
          map[channelId] = { channelId, title, start, end };
        }
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
