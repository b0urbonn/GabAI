import { useEffect, useState } from 'react'
import { Image, StyleSheet, View, type ImageProps, type StyleProp, type ImageStyle } from 'react-native'

const MORION_FRAMES = [
  require('../../assets/morion_frames/f_01.webp'),
  require('../../assets/morion_frames/f_02.webp'),
  require('../../assets/morion_frames/f_03.webp'),
  require('../../assets/morion_frames/f_04.webp'),
  require('../../assets/morion_frames/f_05.webp'),
  require('../../assets/morion_frames/f_06.webp'),
  require('../../assets/morion_frames/f_07.webp'),
  require('../../assets/morion_frames/f_08.webp'),
  require('../../assets/morion_frames/f_09.webp'),
  require('../../assets/morion_frames/f_10.webp'),
  require('../../assets/morion_frames/f_11.webp'),
  require('../../assets/morion_frames/f_12.webp'),
  require('../../assets/morion_frames/f_13.webp'),
  require('../../assets/morion_frames/f_14.webp'),
  require('../../assets/morion_frames/f_15.webp'),
  require('../../assets/morion_frames/f_16.webp'),
  require('../../assets/morion_frames/f_17.webp'),
  require('../../assets/morion_frames/f_18.webp'),
  require('../../assets/morion_frames/f_19.webp'),
  require('../../assets/morion_frames/f_20.webp'),
  require('../../assets/morion_frames/f_21.webp'),
  require('../../assets/morion_frames/f_22.webp'),
  require('../../assets/morion_frames/f_23.webp'),
  require('../../assets/morion_frames/f_24.webp'),
  require('../../assets/morion_frames/f_25.webp'),
  require('../../assets/morion_frames/f_26.webp'),
  require('../../assets/morion_frames/f_27.webp'),
  require('../../assets/morion_frames/f_28.webp'),
  require('../../assets/morion_frames/f_29.webp'),
  require('../../assets/morion_frames/f_30.webp'),
  require('../../assets/morion_frames/f_31.webp'),
  require('../../assets/morion_frames/f_32.webp'),
  require('../../assets/morion_frames/f_33.webp'),
  require('../../assets/morion_frames/f_34.webp'),
  require('../../assets/morion_frames/f_35.webp'),
  require('../../assets/morion_frames/f_36.webp'),
  require('../../assets/morion_frames/f_37.webp'),
  require('../../assets/morion_frames/f_38.webp'),
  require('../../assets/morion_frames/f_39.webp'),
  require('../../assets/morion_frames/f_40.webp'),
  require('../../assets/morion_frames/f_41.webp'),
  require('../../assets/morion_frames/f_42.webp'),
  require('../../assets/morion_frames/f_43.webp'),
  require('../../assets/morion_frames/f_44.webp'),
  require('../../assets/morion_frames/f_45.webp'),
  require('../../assets/morion_frames/f_46.webp'),
  require('../../assets/morion_frames/f_47.webp'),
  require('../../assets/morion_frames/f_48.webp'),
]

type MorionMascotProps = Omit<ImageProps, 'source'> & {
  fps?: number
  paused?: boolean
  style?: StyleProp<ImageStyle>
}

/**
 * Universal animated Morion mascot.
 * 48 tight, smooth frames with natural relaxed pacing.
 * Pre-cached layered frames with opacity toggles prevent any flickering.
 */
export function MorionMascot({ fps = 9, paused = false, style, resizeMode = 'contain', ...rest }: MorionMascotProps) {
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    if (paused) return
    const intervalMs = Math.round(1000 / fps)
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % MORION_FRAMES.length)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [fps, paused])

  const flatStyle = StyleSheet.flatten(style) || {}
  const width = flatStyle.width ?? 92
  const height = flatStyle.height ?? 115

  if (paused) {
    return (
      <Image
        source={MORION_FRAMES[0]}
        style={style}
        resizeMode={resizeMode}
        fadeDuration={0}
        accessibilityLabel="GabAI Morion Mascot"
        {...rest}
      />
    )
  }

  return (
    <View style={[style, { width, height, position: 'relative' }]}>
      {/* Pre-cached frames: only the active frame is displayed, completely eliminating ghosting/leftover frames */}
      {MORION_FRAMES.map((src, i) => (
        <Image
          key={i}
          source={src}
          style={[
            styles.frame,
            {
              opacity: i === frameIndex ? 1 : 0,
              display: i === frameIndex ? 'flex' : 'none',
            },
          ]}
          resizeMode={resizeMode}
          fadeDuration={0}
          {...rest}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
})
