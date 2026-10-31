import { XMLParser, XMLValidator } from 'fast-xml-parser'

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
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false })
type Node = Record<string, unknown>
const node = (value: unknown): Node => value && typeof value === 'object' && !Array.isArray(value) ? value as Node : {}
const list = (value: unknown): unknown[] => value === undefined ? [] : Array.isArray(value) ? value : [value]
const string = (value: unknown): string => typeof value === 'string' ? value : ''
const clean = (value: unknown) => string(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const date = (value: unknown) => Date.parse(string(value))
const localArea = /\b(marinduque|mimaropa|region\s*(?:iv[\s-]*b|4[\s-]*b)|philippines|nationwide)\b/i

function xml(value: string): Node {
  if (value.length > 1_500_000 || /<!DOCTYPE|<!ENTITY/i.test(value) || XMLValidator.validate(value) !== true) {
    throw new Error('Invalid official feed')
  }
  return node(parser.parse(value))
}

/** Only navigate to the original agency; never trust arbitrary links inside a feed. */
export function officialUrl(value: unknown, source: UpdateSource): string | null {
  try {
    const url = new URL(string(value))
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

export function parseAgencyNews(value: string, now = Date.now()): PublicUpdate[] {
  const channel = node(node(xml(value).rss).channel)
  if (!('item' in channel) && !channel.title) throw new Error('Missing news channel')
  const items = list(channel.item).flatMap((entry): PublicUpdate[] => {
    const item = node(entry)
    const url = officialUrl(item.link, 'phivolcs')
    const title = clean(item.title)
    if (!url || !title) return []
    return [{ id: url, source: 'phivolcs', kind: 'news', title, url,
      summary: clean(item.description).slice(0, 260), publishedAt: date(item.pubDate), area: 'Philippines · agency news' }]
  })
  return currentUpdates(items, now).slice(0, 6)
}

export function parseWeatherFeed(value: string, now = Date.now()): string[] {
  const feed = node(xml(value).feed)
  if (!feed.title) throw new Error('Missing weather feed')
  return list(feed.entry).flatMap((entry): string[] => {
    const item = node(entry)
    const published = date(item.updated)
    const title = clean(item.title)
    if (!Number.isFinite(published) || published < now - DAY || published > now + 5 * 60 * 1000) return []
    // Regional bulletins for other islands do not belong in Marinduque's feed.
    if (/\b(region\s+\w+|BARMM|CAR\b)/i.test(title) && !localArea.test(title)) return []
    return list(item.link).flatMap((link): string[] => {
      const url = officialUrl(node(link)['@_href'], 'pagasa')
      return url && node(link)['@_type'] === 'application/cap+xml' ? [url] : []
    })
  }).filter((url, index, urls) => urls.indexOf(url) === index).slice(0, 12)
}

export function parseWeatherAlert(value: string, bulletinUrl: string, now = Date.now()): { items: PublicUpdate[]; supersedes: string[] } {
  const alert = node(xml(value).alert)
  const supersedes = string(alert.references).split(/\s+/).map((ref) => ref.split(',')[1]).filter(Boolean)
  if (alert.status !== 'Actual' || alert.scope !== 'Public') return { items: [], supersedes: [] }
  if (alert.msgType === 'Cancel') return { items: [], supersedes }
  if (!['Alert', 'Update'].includes(string(alert.msgType))) return { items: [], supersedes: [] }
  const id = string(alert.identifier)
  const url = officialUrl(bulletinUrl, 'pagasa')
  const items = list(alert.info).flatMap((info): PublicUpdate[] => {
    const detail = node(info)
    const areas = list(detail.area).map((area) => clean(node(area).areaDesc)).filter(Boolean)
    if (!areas.some((area) => localArea.test(area)) || !id || !url) return []
    return [{ id, source: 'pagasa', kind: 'weather', title: clean(detail.headline) || clean(detail.event),
      summary: [clean(detail.description), clean(detail.instruction)].filter(Boolean).join(' '),
      url, publishedAt: date(alert.sent), expiresAt: date(detail.expires), area: areas.join(', ') }]
  })
  return { items: currentUpdates(items, now), supersedes }
}

async function fetchXml(url: string, signal: AbortSignal): Promise<string> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) controller.abort()
  signal.addEventListener('abort', abort)
  const timeout = setTimeout(abort, 12_000)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml' } })
    if (!response.ok) throw new Error('Official source unavailable')
    return await response.text()
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}

export async function fetchPublicUpdates(source: UpdateSource, signal: AbortSignal): Promise<SourceSnapshot> {
  const feed = await fetchXml(UPDATE_SOURCES[source].feed, signal)
  let items: PublicUpdate[]
  if (source === 'phivolcs') items = parseAgencyNews(feed)
  else {
    const links = parseWeatherFeed(feed)
    const alerts = await Promise.all(links.map(async (url) => parseWeatherAlert(await fetchXml(url, signal), url)))
    const superseded = new Set(alerts.flatMap((alert) => alert.supersedes))
    items = currentUpdates(alerts.flatMap((alert) => alert.items).filter((item) => !superseded.has(item.id)))
  }
  return { source, checkedAt: Date.now(), items }
}

/** Treat the cache as untrusted, and reapply expiry checks every time it is read. */
export function parseUpdateCache(value: string, source: UpdateSource): SourceSnapshot | null {
  try {
    const saved = node(JSON.parse(value))
    if (saved.source !== source || typeof saved.checkedAt !== 'number' || !Number.isFinite(saved.checkedAt)
      || saved.checkedAt > Date.now() + 5 * 60 * 1000 || !Array.isArray(saved.items)) return null
    const items = saved.items.filter((item): item is PublicUpdate => {
      const entry = node(item)
      return entry.source === source && entry.kind === (source === 'pagasa' ? 'weather' : 'news')
        && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.summary === 'string'
        && typeof entry.area === 'string' && typeof entry.url === 'string' && typeof entry.publishedAt === 'number'
    })
    return { source, checkedAt: saved.checkedAt, items: currentUpdates(items) }
  } catch { return null }
}
