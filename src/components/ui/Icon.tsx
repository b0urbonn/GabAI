import type { ReactNode } from 'react'
import type { ColorValue } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

export type IconName =
  | 'home' | 'book' | 'chat' | 'kit' | 'phone' | 'wifiOff' | 'search' | 'chevron' | 'shield'
  | 'storm' | 'flood' | 'landslide' | 'quake' | 'fire' | 'bleeding' | 'burn' | 'choking' | 'fracture'
  | 'sun' | 'moon' | 'system' | 'send' | 'arrowLeft' | 'arrowUp' | 'check' | 'profile' | 'heart' | 'settings'
  | 'download' | 'restore' | 'trash' | 'camera' | 'image' | 'close' | 'calendar' | 'chevronDown'
  | 'cloud' | 'rain' | 'wind' | 'pin' | 'eye' | 'chart' | 'paperclip'
  | 'shuffle' | 'sparkles' | 'edit' | 'mic' | 'stop' | 'speaker' | 'bell'

/** Stroke icon set ported 1:1 from the web prototype (24×24 grid, 1.8 stroke). */
const paths: Record<IconName, ReactNode> = {
  home: <><Path d="m3 10 9-7 9 7"/><Path d="M5 9v11h14V9"/><Path d="M9 20v-7h6v7"/></>,
  book: <><Path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23Z"/><Path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23Z"/></>,
  chat: <><Path d="M21 12a8.5 8.5 0 0 1-9 8.5 10 10 0 0 1-3.8-.8L3 21l1.5-4.3A8.6 8.6 0 1 1 21 12Z"/><Path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
  kit: <><Rect x="3" y="6" width="18" height="15" rx="3"/><Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M9 13h6M12 10v6"/></>,
  phone: <Path d="M7.2 3H4.5A1.5 1.5 0 0 0 3 4.6C3.5 13.4 10.6 20.5 19.4 21a1.5 1.5 0 0 0 1.6-1.5v-2.7l-4.2-1-1.3 2.1c-4.2-1.8-7.6-5.2-9.4-9.4l2.1-1.3Z"/>,
  wifiOff: <Path d="m2 2 20 20M8.5 8.5A9 9 0 0 1 21 9M3 9a13 13 0 0 1 3.2-2.2M6 13a9 9 0 0 1 6-2.5M18 13a9 9 0 0 0-2.2-1.4M9.5 17a3.5 3.5 0 0 1 5 0M12 21h.01"/>,
  search: <><Circle cx="11" cy="11" r="7"/><Path d="m20 20-4-4"/></>,
  chevron: <Path d="m9 18 6-6-6-6"/>,
  shield: <><Path d="M12 2 4.5 5v6c0 5 3 8.7 7.5 11 4.5-2.3 7.5-6 7.5-11V5Z"/><Path d="m9 12 2 2 4-5"/></>,
  storm: <><Path d="M6 16a4 4 0 0 1 .8-7.9A6 6 0 0 1 18 9.5 3.5 3.5 0 0 1 18 16H6Z"/><Path d="m13 17-3 5h4l-1 2"/></>,
  flood: <><Path d="M4 5h16M7 5v6M17 5v6"/><Path d="M3 14c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0M3 19c1.5-1.3 3-1.3 4.5 0s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0"/></>,
  landslide: <><Path d="M3 20 10 5l4 7 2-3 5 11Z"/><Circle cx="17.5" cy="5" r="1.5"/><Path d="m14 16 2 2m-6-2 1 1"/></>,
  quake: <><Path d="M4 21V8l5-5 5 5v13M14 11l3-3 3 3v10"/><Path d="m8 7 3 4-3 3 3 4"/></>,
  fire: <Path d="M13 22c4.5-.6 7-3.7 7-7.5 0-3-1.7-5.7-4-7.5.1 2.2-.8 3.7-2.1 4.4.2-4.3-2.4-7.4-5.5-9.4.1 4.7-4.4 7.1-4.4 12.3 0 4.1 2.8 7.1 7 7.7-1.7-1.1-2.4-2.7-1.8-4.5.5-1.4 1.6-2.3 2.7-3.5.1 2 1.2 3 2.2 3.8.8.7.7 2.7-1.1 4.2Z"/>,
  bleeding: <><Path d="M12 2s5 6 5 11a5 5 0 0 1-10 0c0-5 5-11 5-11Z"/><Path d="M9 14c.3 1.3 1.1 2 2.3 2.3"/></>,
  burn: <><Path d="M12 22c4-1 6-3.8 6-7.2 0-2.8-1.4-5-3.7-7.2.1 2.4-.9 3.7-2.1 4.3.3-4-1.6-7.4-4.3-9.9.2 5-2.9 7.7-2.9 12.3C5 18 7.7 21 12 22Z"/><Path d="M9 19c-1.2-2.4.6-4.3 2.2-5.7-.1 2 .8 2.7 1.6 3.5.7.7.4 1.7-.2 2.5"/></>,
  choking: <><Circle cx="12" cy="4" r="2"/><Path d="M8 22v-7l2-4-2-4M16 22v-7l-2-4 2-4M10 9h4"/><Path d="m17 9 3 2-3 2"/></>,
  fracture: <Path d="M8 3v7l3 2-2 3 5 2v4M16 3v6l-2 2 2 3-3 2v5"/>,
  sun: <><Circle cx="12" cy="12" r="4"/><Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <Path d="M21 15.5A9 9 0 0 1 8.5 3 9 9 0 1 0 21 15.5Z"/>,
  system: <><Rect x="3" y="4" width="18" height="13" rx="2"/><Path d="M8 21h8M12 17v4"/></>,
  send: <><Path d="m22 2-7 20-4-9-9-4Z"/><Path d="M22 2 11 13"/></>,
  arrowLeft: <><Path d="m15 18-6-6 6-6"/><Path d="M9 12h11"/></>,
  arrowUp: <Path d="M12 19V5m-7 7 7-7 7 7"/>,
  check: <Path d="m5 12 4 4L19 6"/>,
  profile: <><Circle cx="12" cy="8" r="4"/><Path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  heart: <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
  settings: <><Path d="m9 3-.5 2.3-2 .9-2-.7L2 9l1.6 1.6v2.8L2 15l2.5 3.5 2-.7 2 .9L9 21h6l.5-2.3 2-.9 2 .7L22 15l-1.6-1.6v-2.8L22 9l-2.5-3.5-2 .7-2-.9L15 3Z"/><Circle cx="12" cy="12" r="3"/></>,
  download: <Path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>,
  restore: <Path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l3 2"/>,
  trash: <Path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>,
  camera: <><Path d="M8 5 6.5 8H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2.5L16 5Z"/><Circle cx="12" cy="14" r="4"/></>,
  image: <><Rect x="3" y="3" width="18" height="18" rx="3"/><Circle cx="9" cy="9" r="2"/><Path d="m21 15-5-5L5 21"/></>,
  close: <Path d="M6 6l12 12M18 6 6 18"/>,
  calendar: <><Rect x="3" y="5" width="18" height="16" rx="2"/><Path d="M16 3v4M8 3v4M3 11h18"/></>,
  chevronDown: <Path d="m6 9 6 6 6-6"/>,
  cloud: <Path d="M6 18a4.5 4.5 0 0 1-.3-9A6.5 6.5 0 0 1 18 8a5 5 0 0 1 0 10Z"/>,
  rain: <><Path d="M6 14a4 4 0 0 1 0-8 6 6 0 0 1 11 1 3.5 3.5 0 0 1 1 7"/><Path d="m8 17-1 3m6-3-1 3m6-3-1 3"/></>,
  wind: <><Path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h6a3 3 0 1 1-3 3"/></>,
  pin: <><Path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z"/><Circle cx="12" cy="10" r="2"/></>,
  eye: <><Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><Circle cx="12" cy="12" r="3"/></>,
  chart: <><Path d="M3 3v18h18"/><Path d="M18 17V9"/><Path d="M13 17V5"/><Path d="M8 17v-3"/></>,
  paperclip: <Path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>,
  shuffle: <><Path d="M16 3h5v5"/><Path d="M4 20 21 3"/><Path d="M21 16v5h-5"/><Path d="m15 15 6 6"/><Path d="M4 4l5 5"/></>,
  sparkles: <><Path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><Path d="M19 3v4M17 5h4M5 17v3M3.5 18.5h3"/></>,
  edit: <><Path d="M12 20h9"/><Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></>,
  mic: <><Rect x="9" y="1" width="6" height="13" rx="3"/><Path d="M19 10v2a7 7 0 0 1-14 0v-2"/><Path d="M12 19v4M8 23h8"/></>,
  stop: <Rect x="7" y="7" width="10" height="10" rx="2.5"/>,
  speaker: <><Path d="M11 5 6 9H2v6h4l5 4V5Z"/><Path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></>,
  bell: <><Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><Path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
}

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: ColorValue }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </Svg>
  )
}
