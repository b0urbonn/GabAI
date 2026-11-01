import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'

import { AppText } from '@/components/ui/AppText'
import { Touchable } from '@/components/ui/Touchable'
import { useReduceMotion } from '@/hooks/useReduceMotion'
import { brand, palette, radius, space, typeRamp } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

/** Smooth ~2-second crossfade transition duration for the DRRM background slideshow. */
const TRANSITION_DURATION_MS = 2000
/** Comfortable viewing window before the next 2-second crossfade begins. */
const HOLD_DURATION_MS = 2400
/** Total Ken Burns settle duration across hold + transition. */
const KEN_BURNS_DURATION_MS = HOLD_DURATION_MS + TRANSITION_DURATION_MS
const INITIAL_KEN_BURNS_SCALE = 1.06
/** Cross-platform soft-focus blur so foreground copy stays calm and effortless to read. */
const BACKGROUND_BLUR_RADIUS = Platform.select({ ios: 9, android: 7, default: 8 })
/** 80% background stage opacity requested for vibrant yet atmospheric DRRM imagery. */
const BACKGROUND_STAGE_OPACITY = 0.8

type DrmBackgroundSlide = {
  id: string
  source: ImageSourcePropType
  accessibilityLabel: string
}

/**
 * Authentic, open-license Philippine Disaster Risk Management (DRRM) photographs
 * portrait-framed and bundled locally so the Welcome screen works 100% offline.
 */
const DRM_SLIDES: readonly DrmBackgroundSlide[] = [
  {
    id: 'typhoon',
    source: require('../../assets/welcome/drm-1-typhoon.webp'),
    accessibilityLabel: 'Satellite view of a typhoon swirling over Marinduque and Luzon in the Philippines',
  },
  {
    id: 'coastal-rescue',
    source: require('../../assets/welcome/drm-2-coastal-rescue.webp'),
    accessibilityLabel: 'Philippine Coast Guard search and rescue boat responding across coastal waters',
  },
  {
    id: 'search-rescue',
    source: require('../../assets/welcome/drm-3-search-rescue.webp'),
    accessibilityLabel: 'Philippine disaster response rescuers operating an emergency rescue stretcher',
  },
  {
    id: 'first-aid',
    source: require('../../assets/welcome/drm-4-first-aid.webp'),
    accessibilityLabel: 'Barangay health responders practicing hands-on CPR and emergency first aid',
  },
]

const TEAM_NAMES = [
  'Ruby Charlene Perilla',
  'Terrence Briones',
  'Lyka Tolosa',
] as const

type WelcomeShowcaseProps = {
  totalSteps?: number
  onGetStarted: () => void
}

/**
 * Minimalist, centered full-bleed onboarding welcome screen for GabAI.
 * Cycles through 4 softly blurred, subdued Disaster Risk Management background photographs
 * using a zero-dip 2-second (2000ms) optical crossfade + subtle Ken Burns motion.
 */
export function WelcomeShowcase({ onGetStarted }: WelcomeShowcaseProps) {
  const insets = useSafeAreaInsets()
  const { scale } = useTheme()
  const [stage, setStage] = useState<{ active: number; previous: number | null }>({
    active: 0,
    previous: null,
  })
  const reduceMotion = useReduceMotion()

  const [opacities] = useState(() =>
    DRM_SLIDES.map((_, index) => new Animated.Value(index === 0 ? 1 : 0)),
  )
  const [scales] = useState(() =>
    DRM_SLIDES.map(() => new Animated.Value(INITIAL_KEN_BURNS_SCALE)),
  )

  const activeRef = useRef(0)
  const reduceMotionRef = useRef(false)

  useEffect(() => {
    reduceMotionRef.current = reduceMotion
  }, [reduceMotion])

  useEffect(() => {
    if (reduceMotion) {
      scales[0].setValue(1)
      return
    }
    scales[0].setValue(INITIAL_KEN_BURNS_SCALE)
    const introAnim = Animated.timing(scales[0], {
      toValue: 1,
      duration: KEN_BURNS_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    })
    introAnim.start()
    return () => introAnim.stop()
  }, [reduceMotion, scales])

  const transitionToSlide = useCallback(
    (nextIndex: number) => {
      const currentActive = activeRef.current
      if (nextIndex === currentActive) return

      activeRef.current = nextIndex

      // Keep the outgoing photograph at opacity 1 underneath while the incoming layer
      // fades from 0 -> 1 over 2000ms so the crossfade never dips in brightness.
      DRM_SLIDES.forEach((_, idx) => {
        opacities[idx].stopAnimation()
        if (idx === currentActive) {
          opacities[idx].setValue(1)
        } else if (idx !== nextIndex) {
          opacities[idx].setValue(0)
        }
      })

      scales[nextIndex].stopAnimation()
      opacities[nextIndex].setValue(0)
      scales[nextIndex].setValue(reduceMotionRef.current ? 1 : INITIAL_KEN_BURNS_SCALE)

      setStage({ active: nextIndex, previous: currentActive })

      const animations: Animated.CompositeAnimation[] = [
        Animated.timing(opacities[nextIndex], {
          toValue: 1,
          duration: TRANSITION_DURATION_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]

      if (!reduceMotionRef.current) {
        animations.push(
          Animated.timing(scales[nextIndex], {
            toValue: 1,
            duration: KEN_BURNS_DURATION_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        )
      }

      Animated.parallel(animations).start(({ finished }) => {
        if (finished && activeRef.current === nextIndex) {
          opacities[currentActive].setValue(0)
        }
      })
    },
    [opacities, scales],
  )

  useEffect(() => {
    const stepMs = HOLD_DURATION_MS + TRANSITION_DURATION_MS
    let intervalId: ReturnType<typeof setInterval> | null = null

    const firstTimeoutId = setTimeout(() => {
      transitionToSlide((activeRef.current + 1) % DRM_SLIDES.length)
      intervalId = setInterval(() => {
        transitionToSlide((activeRef.current + 1) % DRM_SLIDES.length)
      }, stepMs)
    }, HOLD_DURATION_MS)

    return () => {
      clearTimeout(firstTimeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [transitionToSlide])

  const activeSlide = DRM_SLIDES[stage.active]
  const wordmarkSize = Math.round(typeRamp.pageTitle.fontSize * 1.38 * scale)
  const wordmarkLineHeight = Math.round(wordmarkSize * 1.14)

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Full-bleed, softly blurred & subdued Disaster Risk Management background stage */}
      <View
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityRole="image"
        accessibilityLabel={activeSlide.accessibilityLabel}
      >
        <View style={styles.photoStage} pointerEvents="none">
          {DRM_SLIDES.map((slide, index) => {
            const zIndex = index === stage.active ? 2 : index === stage.previous ? 1 : 0
            return (
              <Animated.View
                key={slide.id}
                style={[
                  styles.slideLayer,
                  {
                    zIndex,
                    opacity: opacities[index],
                    transform: [{ scale: scales[index] }],
                  },
                ]}
              >
                <Image
                  source={slide.source}
                  resizeMode="cover"
                  blurRadius={BACKGROUND_BLUR_RADIUS}
                  fadeDuration={0}
                  accessibilityIgnoresInvertColors
                  style={styles.backgroundImage}
                />
              </Animated.View>
            )
          })}
        </View>

        {/* Balanced atmospheric veil + center optical cushion so 80% imagery shines while text stays AAA-legible */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="welcome-scrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0c0707" stopOpacity="0.26" />
                <Stop offset="0.5" stopColor="#0a0505" stopOpacity="0.36" />
                <Stop offset="1" stopColor="#070303" stopOpacity="0.48" />
              </LinearGradient>
              <RadialGradient id="welcome-center-focus" cx="50%" cy="50%" rx="72%" ry="34%">
                <Stop offset="0" stopColor="#080404" stopOpacity="0.46" />
                <Stop offset="1" stopColor="#080404" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcome-scrim)" />
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcome-center-focus)" />
          </Svg>
        </View>
      </View>

      {/* Minimalist, vertically & horizontally centered foreground */}
      <View
        style={[
          styles.centerContainer,
          {
            paddingTop: insets.top + space[6],
            paddingBottom: insets.bottom + space[6],
          },
        ]}
      >
        <View style={styles.heroBlock}>
          <Image
            source={require('../../assets/MorionLogo.webp')}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel="Morion Logo"
            style={styles.logo}
          />

          <AppText
            weight="800"
            align="center"
            accessibilityRole="header"
            accessibilityLabel="GabAI"
            style={[
              styles.wordmark,
              {
                fontSize: wordmarkSize,
                lineHeight: wordmarkLineHeight,
              },
            ]}
          >
            Gab
            <AppText
              weight="800"
              style={[
                styles.wordmarkAccent,
                {
                  fontSize: wordmarkSize,
                  lineHeight: wordmarkLineHeight,
                },
              ]}
            >
              AI
            </AppText>
          </AppText>

          <AppText variant="body" align="center" style={styles.description}>
            Your offline-first AI-powered personal safety assistant.
          </AppText>
          <AppText variant="caption" align="center" style={styles.tagline}>
            Always know what&rsquo;s next.
          </AppText>

          <View style={styles.actionWrap}>
            <Touchable onPress={onGetStarted} accessibilityRole="button" style={styles.ctaButton}>
              <View style={styles.ctaGradient}>
                {/* Reuse SVG already in the dev client instead of requiring another native view. */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
                  <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient id="welcome-cta" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#ff922b" />
                        <Stop offset="1" stopColor={brand.primary} />
                      </LinearGradient>
                    </Defs>
                    <Rect width="1" height="1" fill="url(#welcome-cta)" />
                  </Svg>
                </View>
                <AppText variant="bodyStrong" align="center" style={{ color: brand.onPrimary }}>Get started</AppText>
              </View>
            </Touchable>
          </View>
        </View>

        {/* Footer credits anchored to the bottom so the hero block stays optically centered */}
        <View style={styles.credits}>
          <AppText variant="eyebrow" align="center" style={styles.creditsHeading}>
            Built by the Team Pixel6
          </AppText>
          <View style={styles.creditNames}>
            {TEAM_NAMES.map((name) => (
              <AppText key={name} variant="small" weight="600" align="center" style={styles.creditName}>
                {name}
              </AppText>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0c0707',
  },
  photoStage: {
    ...StyleSheet.absoluteFill,
    opacity: BACKGROUND_STAGE_OPACITY,
  },
  slideLayer: {
    ...StyleSheet.absoluteFill,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
  },
  heroBlock: {
    flex: 1,
    width: '100%',
    maxWidth: 344,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: space[3],
    shadowColor: '#fe6902',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
  },
  wordmark: {
    color: palette.dark.ink,
    letterSpacing: -1.4,
    textShadowColor: 'rgba(0, 0, 0, 0.42)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  wordmarkAccent: {
    color: palette.dark.teal,
    letterSpacing: -1.4,
  },
  description: {
    marginTop: space[3],
    maxWidth: 332,
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.36)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  tagline: {
    marginTop: space[2],
    color: 'rgba(255, 255, 255, 0.62)',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.36)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  actionWrap: {
    width: '100%',
    maxWidth: 224,
    flexDirection: 'row',
    marginTop: space[8],
  },
  ctaButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  ctaGradient: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  credits: {
    width: '100%',
    alignItems: 'center',
    gap: space[2],
  },
  creditNames: {
    alignItems: 'center',
    gap: space[1],
  },
  creditsHeading: {
    color: 'rgba(255, 255, 255, 0.55)',
    textShadowColor: 'rgba(0, 0, 0, 0.36)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  creditName: {
    fontSize: 12,
    lineHeight: 15,
    color: 'rgba(255, 255, 255, 0.92)',
    textShadowColor: 'rgba(0, 0, 0, 0.36)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
})
