import { createAvatar } from '@dicebear/core'
import * as micah from '@dicebear/micah'
import { useMemo } from 'react'
import { SvgXml } from 'react-native-svg'

const MICAH_BACKGROUNDS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'b8e6d4']

export function randomAvatarSeed(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** DiceBear "micah" avatar, generated locally so it works fully offline. */
export function MicahAvatar({ seed, size }: { seed: string; size: number }) {
  const xml = useMemo(
    () =>
      createAvatar(micah, {
        seed,
        size,
        backgroundColor: MICAH_BACKGROUNDS,
      }).toString(),
    [seed, size],
  )
  return <SvgXml xml={xml} width={size} height={size} />
}
