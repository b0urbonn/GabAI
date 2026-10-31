import { useSQLiteContext } from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, View } from 'react-native'

import { AppText } from '@/components/ui/AppText'
import { Icon } from '@/components/ui/Icon'
import { Touchable } from '@/components/ui/Touchable'
import { weatherArtwork } from '@/data/weatherArtwork'
import { conditionFor } from '@/data/weatherConditions'
import {
  readWeatherCache,
  writeCurrentWeather,
  writeForecastCache,
  type WeatherForecastDay,
  type WeatherLocation,
  type WeatherReport,
} from '@/db/weatherCache'
import { getCurrentBarangay } from '@/services/location'
import { radius, space, touchTarget } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

function parseWeatherPayload(payload: unknown): WeatherReport {
  const data = payload as { current?: Record<string, unknown>; daily?: Record<string, unknown> } | null
  const current = data?.current
  const daily = data?.daily
  const number = (field: string) => {
    const value = current?.[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Weather report unavailable')
    return value
  }
  const today = (field: string): number | null => {
    const value = Array.isArray(daily?.[field]) ? (daily[field] as unknown[])[0] : null
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }
  const time = current?.time
  if (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(time)) {
    throw new Error('Weather report unavailable')
  }
  return {
    temperature: number('temperature_2m'),
    feelsLike: number('apparent_temperature'),
    code: number('weather_code'),
    time,
    isDay: number('is_day') === 1,
    high: today('temperature_2m_max'),
    low: today('temperature_2m_min'),
    precipitationChance: today('precipitation_probability_max'),
  }
}

function average(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function seriesValue(series: unknown[], index: number): number | null {
  const value = series[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseForecastPayload(payload: unknown): WeatherForecastDay[] {
  const data = payload as { daily?: Record<string, unknown>; hourly?: Record<string, unknown> } | null
  const daily = data?.daily
  const times = daily?.time
  if (!Array.isArray(times)) throw new Error('Weather forecast unavailable')
  const dailyValues = (field: string): unknown[] => Array.isArray(daily?.[field]) ? daily[field] as unknown[] : []
  const hourlyValues = (field: string): unknown[] => Array.isArray(data?.hourly?.[field]) ? data.hourly[field] as unknown[] : []
  const hourlyTimes = hourlyValues('time')
  const hourlyHumidity = hourlyValues('relative_humidity_2m')
  const hourlyVisibility = hourlyValues('visibility')
  const humidityByDate = new Map<string, number[]>()
  const visibilityByDate = new Map<string, number[]>()

  hourlyTimes.forEach((time, index) => {
    if (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(time)) return
    const date = time.slice(0, 10)
    const humidity = seriesValue(hourlyHumidity, index)
    const visibility = seriesValue(hourlyVisibility, index)
    if (humidity !== null) humidityByDate.set(date, [...(humidityByDate.get(date) ?? []), humidity])
    if (visibility !== null) visibilityByDate.set(date, [...(visibilityByDate.get(date) ?? []), visibility / 1000])
  })

  const highs = dailyValues('temperature_2m_max')
  const lows = dailyValues('temperature_2m_min')
  const codes = dailyValues('weather_code')
  const precipitation = dailyValues('precipitation_probability_max')
  const winds = dailyValues('wind_speed_10m_max')
  const today = manilaDate(0)
  return times.flatMap((time, index) => {
    if (typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(time)) return []
    const high = seriesValue(highs, index)
    const low = seriesValue(lows, index)
    const code = seriesValue(codes, index)
    if (high === null || low === null || code === null) return []
    const dateLabel = time === today ? 'Today' : new Date(`${time}T12:00:00+08:00`).toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    return [{
      date: time,
      dateLabel,
      low: Math.round(low),
      high: Math.round(high),
      precipitationChance: seriesValue(precipitation, index),
      humidity: average(humidityByDate.get(time) ?? []),
      wind: seriesValue(winds, index),
      visibility: average(visibilityByDate.get(time) ?? []),
      code,
    }]
  })
}

function manilaDate(daysFromToday = 0): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000 + daysFromToday * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

const DEFAULT_LOCATION: WeatherLocation = { label: 'Boac, Marinduque', latitude: 13.4463, longitude: 121.8395 }

/** Nearest barangay for the weather pin; Boac town when GPS is denied, unavailable, or off-island. */
async function weatherLocation(): Promise<WeatherLocation> {
  const lookup = await getCurrentBarangay()
  if (lookup.status !== 'ok') return DEFAULT_LOCATION
  return {
    label: `${lookup.barangay.barangay}, ${lookup.barangay.municipality}`,
    latitude: lookup.barangay.lat,
    longitude: lookup.barangay.lng,
  }
}

function displayMetric(value: number | null, unit: string, digits = 0): string {
  return value === null ? '—' : `${digits ? value.toFixed(digits) : Math.round(value)}${unit}`
}

export function WeatherCard() {
  const { colors, scale, scheme } = useTheme()
  const db = useSQLiteContext()
  const [report, setReport] = useState<WeatherReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [forecastOpen, setForecastOpen] = useState(false)
  const [forecastRefresh, setForecastRefresh] = useState(0)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastFailed, setForecastFailed] = useState(false)
  const [forecast, setForecast] = useState<WeatherForecastDay[]>([])
  const [geo, setGeo] = useState<WeatherLocation>(DEFAULT_LOCATION)

  const refreshWeather = () => {
    setLoading(true)
    setRefresh((value) => value + 1)
  }

  const requestForecast = () => {
    setForecastLoading(true)
    setForecastFailed(false)
    setForecastRefresh((value) => value + 1)
  }

  const openForecast = () => {
    requestForecast()
    setForecastOpen(true)
  }

  const refreshForecast = () => {
    refreshWeather()
    requestForecast()
  }

  useEffect(() => {
    let active = true
    const hydrate = async () => {
      try {
        const cache = await readWeatherCache(db)
        if (!active) return
        if (cache.current) {
          setReport((prev) => prev ?? cache.current?.report ?? null)
          setUpdatedAt((prev) => prev ?? cache.current?.updatedAt ?? null)
          setGeo((prev) => (prev === DEFAULT_LOCATION ? cache.current?.geo ?? prev : prev))
          setNow(Date.now())
        }
        if (cache.forecast) setForecast((prev) => (prev.length ? prev : cache.forecast?.days ?? prev))
      } catch {
        // A missing or unreadable cache just means the usual "Checking the weather…" state.
      }
    }
    void hydrate()
    return () => { active = false }
  }, [db])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 10000)
    const load = async () => {
      try {
        const place = await weatherLocation()
        if (!active) return
        setGeo((prev) => (prev.latitude === place.latitude && prev.longitude === place.longitude ? prev : place))
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,is_day,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=Asia%2FManila`
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error('Weather unavailable')
        const next = parseWeatherPayload(await response.json() as unknown)
        if (active) {
          const fetchedAt = Date.now()
          setReport(next)
          setUpdatedAt(fetchedAt)
          setNow(fetchedAt)
          setFailed(false)
          void writeCurrentWeather(db, { report: next, updatedAt: fetchedAt, geo: place }).catch(() => {})
        }
      } catch {
        if (active) setFailed(true)
      } finally {
        clearTimeout(timeout)
        if (active) setLoading(false)
      }
    }
    void load()
    const nextUpdate = setInterval(() => {
      setLoading(true)
      setRefresh((value) => value + 1)
    }, 15 * 60 * 1000)
    const ageUpdate = setInterval(() => setNow(Date.now()), 60 * 1000)
    return () => {
      active = false
      controller.abort()
      clearTimeout(timeout)
      clearInterval(nextUpdate)
      clearInterval(ageUpdate)
    }
  }, [refresh, db])

  useEffect(() => {
    if (!forecastOpen) return
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const loadForecast = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&hourly=relative_humidity_2m,visibility&forecast_days=7&timezone=Asia%2FManila`
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error('Weather forecast unavailable')
        const records = parseForecastPayload(await response.json() as unknown)
        if (active) {
          setForecast(records)
          setForecastFailed(records.length === 0)
          if (records.length) void writeForecastCache(db, { days: records, fetchedAt: Date.now(), geo }).catch(() => {})
        }
      } catch {
        if (active) setForecastFailed(true)
      } finally {
        clearTimeout(timeout)
        if (active) setForecastLoading(false)
      }
    }
    void loadForecast()
    return () => {
      active = false
      controller.abort()
      clearTimeout(timeout)
    }
  }, [forecastOpen, forecastRefresh, geo, db])

  const condition = report ? conditionFor(report.code, report.isDay) : null
  const artwork = condition?.background ? weatherArtwork[condition.background] : null
  const age = updatedAt ? Math.max(0, Math.floor((now - updatedAt) / 60000)) : null
  const status = loading ? 'Updating…' : failed ? 'Update unavailable' : age === null ? 'Not updated' : age ? `Updated ${age} min ago` : 'Updated just now'
  const scrim = scheme === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)'
  const frosted = scheme === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.78)'

  return (
    <>
      <View accessibilityLabel={`Weather in ${geo.label}`} accessibilityState={{ busy: loading }} style={[styles.card, { backgroundColor: colors.surface }]}>
        {artwork ? (
          <Image
            source={artwork}
            resizeMode="cover"
            accessible={false}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {artwork ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]} /> : null}
        <View style={styles.header}>
          <View style={styles.location}>
            <Icon name="pin" size={15} color={colors.inkSoft} />
            <AppText variant="caption" weight="600">{geo.label}</AppText>
          </View>
          <View style={styles.actions}>
            <AppText variant="small" tone="soft">{status}</AppText>
            <Touchable onPress={refreshWeather} accessibilityLabel="Refresh weather" style={styles.refresh}>
              <Icon name="restore" size={17} color={colors.teal} />
            </Touchable>
          </View>
        </View>

        <View style={styles.overview}>
          <View style={styles.current}>
            <View style={styles.temperatureRow}>
              <AppText weight="400" style={[styles.temperature, { fontSize: 56 * scale, lineHeight: 64 * scale }]}>{report ? Math.round(report.temperature) : '—'}</AppText>
              {report ? <AppText style={[styles.degree, { fontSize: 26 * scale }]}>°C</AppText> : null}
            </View>
            <AppText variant="bodyStrong" style={styles.condition}>{condition?.label ?? (loading ? 'Checking the weather…' : 'Weather unavailable')}</AppText>
            {report ? <AppText variant="caption" tone="soft">Feels like {Math.round(report.feelsLike)}°C</AppText> : null}
          </View>
          <View style={[styles.iconBadge, { backgroundColor: frosted }]}>
            <Icon name={condition?.icon ?? 'cloud'} size={30} color={colors.weatherAccent} />
          </View>
        </View>

        {report ? (
          <View style={styles.chips}>
            {report.high !== null && report.low !== null ? (
              <View style={[styles.chip, { backgroundColor: frosted }]}>
                <Icon name="chart" size={13} color={colors.weatherDetailInk} />
                <AppText variant="small" weight="600" style={{ color: colors.weatherDetailInk }}>{Math.round(report.high)}° / {Math.round(report.low)}°</AppText>
              </View>
            ) : null}
            {report.precipitationChance !== null ? (
              <View style={[styles.chip, { backgroundColor: frosted }]}>
                <Icon name="rain" size={13} color={colors.weatherDetailInk} />
                <AppText variant="small" weight="600" style={{ color: colors.weatherDetailInk }}>{Math.round(report.precipitationChance)}% rain today</AppText>
              </View>
            ) : null}
          </View>
        ) : (
          <AppText variant="caption" tone="soft" style={styles.offlineNote}>Internet needed for weather updates</AppText>
        )}

        <Touchable
          onPress={openForecast}
          accessibilityLabel="Open seven-day weather forecast"
          style={[styles.forecastButton, { borderTopColor: colors.line }]}
        >
          <Icon name="calendar" size={18} color={colors.teal} />
          <AppText variant="caption" weight="600" style={styles.forecastButtonLabel}>7-day forecast</AppText>
          <Icon name="chevron" size={17} color={colors.inkSoft} />
        </Touchable>
      </View>

      <Modal visible={forecastOpen} transparent animationType="fade" onRequestClose={() => setForecastOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Touchable
            onPress={() => setForecastOpen(false)}
            accessibilityLabel="Close weather forecast"
            pressedScale={1}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[styles.dialog, { backgroundColor: colors.surface }]}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeading}>
                <AppText variant="sectionTitle">7-day forecast</AppText>
                <AppText variant="small" tone="soft">{geo.label} · Today and the days ahead</AppText>
              </View>
              <Touchable
                onPress={refreshForecast}
                accessibilityLabel="Refresh forecast and location"
                style={[styles.closeButton, { backgroundColor: colors.background }]}
              >
                <Icon name="restore" size={18} color={colors.ink} />
              </Touchable>
              <Touchable
                onPress={() => setForecastOpen(false)}
                accessibilityLabel="Close weather forecast"
                style={[styles.closeButton, { backgroundColor: colors.background }]}
              >
                <Icon name="close" size={18} color={colors.ink} />
              </Touchable>
            </View>

            {forecastLoading && forecast.length === 0 ? (
              <View style={styles.forecastMessage}>
                <ActivityIndicator color={colors.teal} />
                <AppText variant="caption" tone="soft">Loading forecast…</AppText>
              </View>
            ) : forecastFailed && forecast.length === 0 ? (
              <View style={styles.forecastMessage}>
                <Icon name="cloud" size={28} color={colors.inkSoft} />
                <AppText variant="caption" tone="soft" align="center">The forecast is unavailable right now. Check your connection and try again.</AppText>
                <Touchable onPress={openForecast} style={styles.tryAgain}>
                  <AppText variant="caption" tone="teal" weight="600">Try again</AppText>
                </Touchable>
              </View>
            ) : (
              <ScrollView style={styles.forecastList} contentContainerStyle={styles.forecastContent} showsVerticalScrollIndicator={false}>
                {forecast.map((day) => {
                  const dayCondition = conditionFor(day.code, true)
                  return (
                    <View key={day.date} style={[styles.forecastRow, { backgroundColor: colors.background }]}>
                      <View style={styles.forecastTop}>
                        <View style={styles.forecastDateBlock}>
                          <AppText variant="caption" weight="700">{day.dateLabel}</AppText>
                          <AppText variant="small" tone="soft">{dayCondition.label}</AppText>
                          <AppText variant="small" tone="soft">{day.precipitationChance === null ? 'Rain chance unavailable' : `${Math.round(day.precipitationChance)}% chance of rain`}</AppText>
                        </View>
                        <View style={styles.forecastWeather}>
                          <Icon name={dayCondition.icon} size={20} color={colors.weatherAccent} />
                          <AppText variant="bodyStrong">{day.high}°</AppText>
                          <AppText variant="caption" tone="soft">{day.low}°</AppText>
                        </View>
                      </View>
                      <View style={[styles.forecastMetrics, { borderTopColor: colors.line }]}>
                        <ForecastMetric label="Humidity" value={displayMetric(day.humidity, '%')} />
                        <ForecastMetric label="Max wind" value={displayMetric(day.wind, ' km/h')} />
                        <ForecastMetric label="Visibility" value={displayMetric(day.visibility, ' km', 1)} />
                      </View>
                    </View>
                  )
                })}
              </ScrollView>
            )}

            <AppText variant="small" tone="soft" style={styles.attribution}>Forecast data by Open-Meteo.</AppText>
          </View>
        </View>
      </Modal>
    </>
  )
}

function ForecastMetric({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.forecastMetric}>
      <AppText variant="small" tone="soft">{label}</AppText>
      <AppText variant="small" weight="600" style={{ color: colors.weatherDetailInk }}>{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: radius.group, padding: space[4] },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  location: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  refresh: { width: touchTarget, height: touchTarget, marginVertical: -space[2], marginRight: -space[2], alignItems: 'center', justifyContent: 'center' },
  overview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingTop: space[3], paddingBottom: space[2] },
  current: { flex: 1, minWidth: 0 },
  temperatureRow: { flexDirection: 'row', alignItems: 'flex-start' },
  temperature: { fontWeight: '400', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  degree: { marginTop: 5, marginLeft: space[1], letterSpacing: -0.5 },
  condition: { marginTop: space[1] },
  iconBadge: { width: 56, height: 56, borderRadius: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], paddingBottom: space[1] },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: space[2] + 2, paddingVertical: 6 },
  offlineNote: { paddingBottom: space[1] },
  forecastButton: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space[2], borderTopWidth: StyleSheet.hairlineWidth, marginTop: space[2], paddingTop: space[2] },
  forecastButtonLabel: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.42)', alignItems: 'center', justifyContent: 'center', padding: space[5] },
  dialog: { width: '100%', maxWidth: 380, maxHeight: '85%', borderRadius: radius.lg, paddingHorizontal: space[5], paddingTop: space[4], paddingBottom: space[4] },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginBottom: space[4] },
  sheetHeading: { flex: 1, gap: space[1] },
  closeButton: { width: touchTarget, height: touchTarget, borderRadius: touchTarget / 2, alignItems: 'center', justifyContent: 'center' },
  forecastList: { flexShrink: 1 },
  forecastContent: { gap: space[2], paddingBottom: space[3] },
  forecastRow: { padding: space[3], borderRadius: radius.group },
  forecastTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  forecastDateBlock: { flex: 1, gap: 2 },
  forecastWeather: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  forecastMetrics: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2], borderTopWidth: StyleSheet.hairlineWidth, marginTop: space[3], paddingTop: space[2] },
  forecastMetric: { flex: 1, gap: 2 },
  forecastMessage: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: space[3], paddingHorizontal: space[5] },
  tryAgain: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: space[4] },
  attribution: { marginTop: space[2], textAlign: 'center' },
})
