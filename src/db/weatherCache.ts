import type { SQLiteDatabase } from 'expo-sqlite'

export type WeatherLocation = { label: string; latitude: number; longitude: number }

export type WeatherReport = {
  temperature: number
  feelsLike: number
  code: number
  time: string
  isDay: boolean
  high: number | null
  low: number | null
  precipitationChance: number | null
}

export type WeatherForecastDay = {
  date: string
  dateLabel: string
  low: number
  high: number
  precipitationChance: number | null
  humidity: number | null
  wind: number | null
  visibility: number | null
  code: number
}

export type CachedCurrent = { report: WeatherReport; updatedAt: number; geo: WeatherLocation }
export type CachedForecast = { days: WeatherForecastDay[]; fetchedAt: number; geo: WeatherLocation }
export type WeatherCache = { current: CachedCurrent | null; forecast: CachedForecast | null }

function isGeo(value: unknown): value is WeatherLocation {
  const geo = value as WeatherLocation | undefined
  return typeof geo?.label === 'string' && Number.isFinite(geo?.latitude) && Number.isFinite(geo?.longitude)
}

function parseCurrent(payload: string): CachedCurrent | null {
  try {
    const saved = JSON.parse(payload) as Partial<CachedCurrent>
    if (!isGeo(saved.geo) || !Number.isFinite(saved.updatedAt)) return null
    const report = saved.report
    if (!report || !Number.isFinite(report.temperature) || !Number.isFinite(report.code) || typeof report.time !== 'string') return null
    return { report, updatedAt: saved.updatedAt as number, geo: saved.geo }
  } catch {
    return null
  }
}

function parseForecast(payload: string): CachedForecast | null {
  try {
    const saved = JSON.parse(payload) as Partial<CachedForecast>
    if (!isGeo(saved.geo) || !Array.isArray(saved.days)) return null
    const days = saved.days.filter(
      (day) => day && typeof day.date === 'string' && typeof day.dateLabel === 'string' && Number.isFinite(day.high) && Number.isFinite(day.low),
    )
    if (!days.length) return null
    return { days, fetchedAt: Number.isFinite(saved.fetchedAt) ? (saved.fetchedAt as number) : 0, geo: saved.geo }
  } catch {
    return null
  }
}

/** Last weather payloads written by the card; nulls mean nothing usable is stored yet. */
export async function readWeatherCache(db: SQLiteDatabase): Promise<WeatherCache> {
  const rows = await db.getAllAsync<{ kind: string; payload: string }>('SELECT kind, payload FROM weather_cache')
  const payloadFor = (kind: 'current' | 'forecast') => rows.find((row) => row.kind === kind)?.payload ?? null
  const current = payloadFor('current')
  const forecast = payloadFor('forecast')
  return {
    current: current === null ? null : parseCurrent(current),
    forecast: forecast === null ? null : parseForecast(forecast),
  }
}

export async function writeCurrentWeather(db: SQLiteDatabase, snapshot: CachedCurrent) {
  await db.runAsync(
    'INSERT INTO weather_cache (kind, payload) VALUES (?, ?) ON CONFLICT(kind) DO UPDATE SET payload = excluded.payload',
    'current',
    JSON.stringify(snapshot),
  )
}

export async function writeForecastCache(db: SQLiteDatabase, snapshot: CachedForecast) {
  await db.runAsync(
    'INSERT INTO weather_cache (kind, payload) VALUES (?, ?) ON CONFLICT(kind) DO UPDATE SET payload = excluded.payload',
    'forecast',
    JSON.stringify(snapshot),
  )
}
