/**
 * Web implementation of `publicUpdates.ts`.
 * Browser security policies (CORS and Cross-Origin-Embedder-Policy) block cross-origin
 * XML requests to Philippine government servers (PAGASA and PHIVOLCS) directly from the client.
 * In production native builds (iOS / Android), native networking fetches live without CORS.
 * For web previews, this module provides realistic simulated official updates from both agencies.
 */

export type UpdateSource = 'pagasa' | 'phivolcs'
export type PublicUpdate = {
  id: string
  source: UpdateSource
  kind: 'weather' | 'news'
  title: string
  summary: string
  url: string
  publishedAt: number
  expiresAt?: number
  area: string
}
export type SourceSnapshot = { source: UpdateSource; checkedAt: number; items: PublicUpdate[] }

export const UPDATE_SOURCES = {
  pagasa: { name: 'DOST-PAGASA', url: 'https://www.pagasa.dost.gov.ph/', feed: 'https://publicalert.pagasa.dost.gov.ph/feeds/' },
  phivolcs: { name: 'DOST-PHIVOLCS', url: 'https://www.phivolcs.dost.gov.ph/', feed: 'https://www.phivolcs.dost.gov.ph/category/news/feed/' },
} as const

export const REFRESH_INTERVAL = 15 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

export function officialUrl(value: unknown, source: UpdateSource): string | null {
  try {
    const url = new URL(String(value ?? ''))
    const domain = source === 'pagasa' ? 'pagasa.dost.gov.ph' : 'phivolcs.dost.gov.ph'
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port
      || !(url.hostname === domain || url.hostname.endsWith(`.${domain}`))) return null
    url.protocol = 'https:'
    return url.toString()
  } catch { return null }
}

export function currentUpdates(items: PublicUpdate[], now = Date.now()): PublicUpdate[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const valid = Number.isFinite(item.publishedAt) && item.publishedAt <= now + 5 * 60 * 1000
      && officialUrl(item.url, item.source)
      && (item.kind === 'weather'
        ? typeof item.expiresAt === 'number' && item.expiresAt > now && item.publishedAt >= now - DAY
        : item.publishedAt >= now - 3 * DAY)
    if (!valid || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  }).sort((a, b) => (a.kind === b.kind ? b.publishedAt - a.publishedAt : a.kind === 'weather' ? -1 : 1))
}

export function parseAgencyNews(): PublicUpdate[] {
  return []
}

export function parseWeatherFeed(): string[] {
  return []
}

export function parseWeatherAlert(): { items: PublicUpdate[]; supersedes: string[] } {
  return { items: [], supersedes: [] }
}

function getWebPreviewUpdates(source: UpdateSource, now = Date.now()): PublicUpdate[] {
  if (source === 'pagasa') {
    return [
      {
        id: 'pagasa-preview-advisory-1',
        source: 'pagasa',
        kind: 'weather',
        title: 'Weather Advisory · Shear Line affecting Southern Luzon',
        summary: 'Cloudy skies with scattered moderate to heavy rain showers and thunderstorms over MIMAROPA, including Marinduque. Flash floods and landslides are possible during severe downpours.',
        url: 'https://www.pagasa.dost.gov.ph/',
        publishedAt: now - 35 * 60 * 1000,
        expiresAt: now + 12 * 60 * 60 * 1000,
        area: 'Marinduque · MIMAROPA',
      },
    ]
  }

  return [
    {
      id: 'phivolcs-preview-news-1',
      source: 'phivolcs',
      kind: 'news',
      title: 'Earthquake Information Bulletin · Region IV-B & Southern Tagalog',
      summary: 'DOST-PHIVOLCS maintains routine 24/7 seismic station monitoring across Southern Luzon and MIMAROPA. Minor tectonic events reported along active fault segments; no damage or tsunami expected.',
      url: 'https://www.phivolcs.dost.gov.ph/',
      publishedAt: now - 2 * 60 * 60 * 1000,
      area: 'MIMAROPA · Southern Tagalog',
    },
    {
      id: 'phivolcs-preview-news-2',
      source: 'phivolcs',
      kind: 'news',
      title: 'Disaster Preparedness & Fault Line Awareness in Island Municipalities',
      summary: 'Information materials released on structural safety and family earthquake drill preparations for island communities across Marinduque and neighboring provinces.',
      url: 'https://www.phivolcs.dost.gov.ph/',
      publishedAt: now - 18 * 60 * 60 * 1000,
      area: 'Philippines · MIMAROPA',
    },
  ]
}

export async function fetchPublicUpdates(source: UpdateSource, _signal: AbortSignal): Promise<SourceSnapshot> {
  // Simulate network latency for realistic feel in browser preview
  await new Promise((resolve) => setTimeout(resolve, 300))
  const now = Date.now()
  return {
    source,
    checkedAt: now,
    items: getWebPreviewUpdates(source, now),
  }
}

export function parseUpdateCache(value: string, source: UpdateSource): SourceSnapshot | null {
  try {
    const saved = JSON.parse(value) as { source?: string; checkedAt?: unknown; items?: unknown[] }
    if (saved.source !== source || typeof saved.checkedAt !== 'number' || !Number.isFinite(saved.checkedAt)
      || saved.checkedAt > Date.now() + 5 * 60 * 1000 || !Array.isArray(saved.items)) return null
    const items = saved.items.filter((item): item is PublicUpdate => {
      const entry = item as Record<string, unknown>
      return entry.source === source && entry.kind === (source === 'pagasa' ? 'weather' : 'news')
        && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.summary === 'string'
        && typeof entry.area === 'string' && typeof entry.url === 'string' && typeof entry.publishedAt === 'number'
    })
    return { source, checkedAt: saved.checkedAt, items: currentUpdates(items) }
  } catch { return null }
}
