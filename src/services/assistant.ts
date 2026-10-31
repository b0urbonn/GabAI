import type { ChatMessage } from '@/db/chat'
import type { LocalBackend, ReplyLength, Settings } from '@/db/settings'
import type { TokenUsage, UsageSource } from '@/db/tokenUsage'
import { barangayContacts, municipalContacts, nationalContacts, provincialContacts, searchContacts, type ContactSearchResult, type EmergencyContact } from '@/data/contacts'
import { guides, type Guide } from '@/data/guides'
import { MUNICIPALITIES, type Municipality } from '@/data/profile'
import { generateGemini, GeminiError, type GeminiAudio, type GeminiImage } from '@/services/gemini'
import { markGeminiModelUnavailable, modelLabel, resolveModelCandidates } from '@/services/geminiModels'
import { generateLocal, isLocalModelAvailable } from '@/services/localModel'
import { getGeminiKey } from '@/storage/secrets'

/**
 * What the saved profile tells the assistant: where the user lives (grounds hotline
 * answers in the right municipality) and who their personal emergency contact is.
 */
export type AssistantContext = {
  municipality?: Municipality
  barangay?: string
  emergencyContact?: { name: string; phone: string; relationship?: string }
}

const KIT_TERMS = ['kit', 'go-bag', 'go bag', 'emergency bag', 'prepare', 'supplies']

/**
 * Terms that mean the user wants someone to call. `AGENCY_TERMS` alone is enough
 * ("ano ang MDRRMO"); `CONTACT_TERMS` are generic request words. Municipal names are
 * not here on purpose — "baha sa Gasan" wants the flood guide, not a phone list.
 */
const CONTACT_TERMS = ['hotline', 'contact', 'kontak', 'numero', 'number', 'tawag', 'call', 'phone', 'telepono', 'cellphone', 'rescue', 'saklolo', 'nearest', 'malapit', '911']
const AGENCY_TERMS = ['mdrrmo', 'pdrrmo', 'bdrrmc', 'bfp', 'pnp', 'coast guard', 'red cross', 'fire station', 'police', 'pulis', 'bumbero', 'ambulan', 'hospital', 'ospital', 'municipal hall', 'munisipyo', 'barangay hall']

const HAZARD_TERMS = [
  'bagyo', 'typhoon', 'storm', 'hangin', 'signal',
  'baha', 'flood', 'tubig', 'overflow',
  'lindol', 'earthquake', 'quake', 'yanig', 'aftershock', 'tsunami',
  'sunog', 'fire', 'usok', 'smoke', 'apoy',
  'guho', 'landslide', 'mudslide',
  'dugo', 'bleeding', 'sugat', 'wound', 'cut',
  'paso', 'burn', 'scald',
  'bali', 'fracture', 'broken', 'pilay', 'sprain',
  'cpr', 'cardiac', 'unresponsive', 'not breathing', 'walang malay',
  'drown', 'drowning', 'nalunod', 'nalulunod',
]

const CRISIS_TERMS = [
  'next', 'susunod', 'ano gagawin', 'what do i do', 'what to do',
  'what should i do', 'dont know what', 'hindi ko alam', 'trapped', 'emergency',
  'saklolo', 'tulong', 'rescue', 'help', 'now', 'ngayon', 'scared', 'panic',
  'natatakot', 'lost', 'nawawala', 'danger', 'delikado', 'urgent',
]

/**
 * Trigger for injecting the directory into a model prompt: contact words, agency names,
 * hazards, crisis cries, and municipal/barangay mentions.
 */
const DIRECTORY_TERMS = [
  ...CONTACT_TERMS,
  ...AGENCY_TERMS,
  ...HAZARD_TERMS,
  ...CRISIS_TERMS,
  'barangay',
  'brgy',
  ...MUNICIPALITIES.map((municipality) => municipality.toLowerCase()),
]

const wantsContacts = (text: string) => {
  const lower = text.toLowerCase()
  return [...CONTACT_TERMS, ...AGENCY_TERMS].some((term) => lower.includes(term))
}
const wantsDirectory = (text: string) => {
  const lower = text.toLowerCase()
  return DIRECTORY_TERMS.some((term) => lower.includes(term))
}

/** Asking after the user's own emergency contact person, saved in their profile. */
const PERSONAL_CONTACT_TERMS = /\b(my (emergency )?contact|emergency contact (ko|namin|nating)|aking (emergency )?contact|contact person|kontak (ko|namin)|next of kin|kamag-?anak)\b/i

const KIT_ANSWER =
  'A basic emergency kit: 3 days of drinking water and ready-to-eat food, a flashlight with spare batteries, ' +
  'a whistle, a first aid kit, maintenance medicines, a power bank, copies of IDs in a waterproof pouch, cash, ' +
  'and extra clothes. Keep it where everyone at home can grab it quickly.'

const FALLBACK =
  'I am your emergency and disaster safety companion for Marinduque. ' +
  'If you are in immediate danger, call 911 or your local MDRRMO now.\n\n' +
  'I can give you immediate, step-by-step survival guidance for:\n' +
  '- Typhoons and strong winds\n' +
  '- Floods and rising water\n' +
  '- Earthquakes and aftershocks\n' +
  '- Fires and smoke evacuation\n' +
  '- Landslides\n' +
  '- First aid (severe bleeding, burns, fractures, CPR, drowning)\n' +
  '- Verified Marinduque hotlines (MDRRMO, PNP, BFP, Coast Guard)\n\n' +
  'Tell me: What emergency is happening around you right now, and I will guide you on what to do next.'

const SYSTEM_PROMPT =
  'You are GabAI, an offline-first emergency and disaster safety assistant for Marinduque, Philippines. ' +
  'Your mission is to keep people safe, prevent panic, and guide users step-by-step when disaster strikes or when they do not know what to do next.\n\n' +
  'CRITICAL RULES FOR DISASTERS & EMERGENCIES:\n' +
  '1. IMMEDIATE SURVIVAL FIRST: If the user is facing an active hazard (typhoon landfall, rising floodwater, earthquake shaking, house fire, severe injury, or panicked "I don\'t know what\'s next"), give the single most critical physical survival action right away in the first 1-2 lines.\n' +
  '2. HIGH-CONTRAST SCANNABLE STRUCTURE: Under stress and adrenaline, users cannot read long paragraphs. Structure emergency answers with clear bold headings (do not use emojis):\n' +
  '   - **DO THIS RIGHT NOW (Agad-Agad)**: 1-2 urgent physical protective steps (e.g., Drop/Cover/Hold, move to highest stable floor, apply firm direct pressure on bleeding, cut main breaker).\n' +
  '   - **WHAT TO DO NEXT (Susunod na Hakbang)**: 2-4 prioritized chronological steps for the immediate minutes and hours following.\n' +
  '   - **WHAT TO AVOID (Huwag Gawin)**: 1-2 critical hazards (e.g., never walk in moving floodwaters, don\'t use elevators, don\'t light matches if gas is suspected, don\'t pull out embedded objects).\n' +
  '   - **WHO TO CALL (Tawagan)**: Name the exact responder (911, or municipal MDRRMO / PNP / BFP from the provided directory) and briefly tell them what to state: name, exact barangay, number of people, and immediate danger.\n' +
  '3. ALWAYS ANTICIPATE "WHAT\'S NEXT": At the end of ongoing crisis guidance, offer a calm, empowering prompt: "Are you in a safe room right now? Reply with what is happening around you so I can guide your next step."\n' +
  '4. CALM & GROUNDING TONE: Direct, reassuring, and confident. Never begin with conversational fluff, emojis, or bury life-saving actions behind disclaimers.\n' +
  '5. LOCAL MARINDUQUE REALITIES: Ground answers in Marinduque: battery conservation during island power outages (low power mode, SMS over calls), coastal storm surges, mountain landslides, river flash floods, and municipal MDRRMOs (Boac, Buenavista, Gasan, Mogpog, Santa Cruz, Torrijos).\n' +
  '6. LANGUAGE: Match the user\'s language (Tagalog, English, or Taglish). Use clear Filipino disaster terms where appropriate (e.g. lumikas, baha, kuryente, saklolo).\n' +
  '7. HOTLINE ACCURACY: Give phone numbers only from the Marinduque directory in this prompt — never invent a number. For immediate danger, state 911.'

const HISTORY_LIMIT = 10
const N_PREDICT = { short: 320, detailed: 900 } as const

/** Sent instead of SYSTEM_PROMPT when a photo is attached. */
const VISION_PROMPT =
  'You are GabAI, an offline-first emergency safety assistant for Marinduque, Philippines. ' +
  'The user attached a photo of an emergency, disaster scene, hazard, or injury.\n' +
  '1. SCENE ASSESSMENT: Immediately identify visible hazards (flood level, structural cracks, fire/smoke, downed wires, severe wound, broken limb).\n' +
  '2. IMMEDIATE ACTIONS: Tell the user what to do RIGHT NOW to stay safe, followed by WHAT TO DO NEXT.\n' +
  '3. FIRST AID: If an injury is visible, give immediate stabilization steps (e.g., firm continuous pressure for bleeding, immobilize without moving for fractures, cool running water for burns). Advise urgent medical evaluation without formal diagnosis.\n' +
  '4. HAZARDS TO AVOID: Warn against critical dangers (e.g., live electrical wires in water, moving an injured neck/back).\n' +
  '5. WHO TO CALL: Name the relevant responder (911, MDRRMO, BFP, Coast Guard, Red Cross) from the directory.\n' +
  'Reply in the user\'s language (English, Tagalog, or Taglish). Keep steps concise and scannable.'

const AUDIO_PROMPT =
  'You are GabAI, an offline-first emergency safety assistant for Marinduque, Philippines. ' +
  'Listen to the user\'s voice recording carefully — they may be speaking in wind, rain, background noise, or under intense panic.\n' +
  'Understand what disaster or emergency they are experiencing, where they are, and what danger they face.\n' +
  'Answer directly with:\n' +
  '1. Immediate life-saving action to take RIGHT NOW.\n' +
  '2. Numbered steps for WHAT TO DO NEXT.\n' +
  '3. Who to contact (911 or local Marinduque MDRRMO).\n' +
  'Reply in the user\'s language (English, Tagalog, or Taglish). Keep sentences short and easy to understand when read aloud.'

/**
 * Cloud length control has to go through the prompt: Gemini counts thought tokens
 * against maxOutputTokens, so capping that truncates the answer instead of shortening it.
 */
const LENGTH_PROMPT = {
  short: 'Keep the whole answer under 120 words.',
  detailed: 'Use at most 10 steps.',
} as const

function findGuide(question: string): Guide | undefined {
  const text = question.toLowerCase()
  let best: { guide: Guide; score: number } | undefined
  for (const guide of guides) {
    const score = guide.keywords.reduce((total, keyword) => total + (text.includes(keyword) ? keyword.length : 0), 0)
    if (score > 0 && (!best || score > best.score)) best = { guide, score }
  }
  return best?.guide
}

const GENERAL_CRISIS_PATTERN =
  /\b(next|susunod|ano (ang )?susunod|what('s| is| to do| should i do) next|ano gagawin|anong gagawin|dont know what|hindi ko alam|trapped|saklolo|tulong|help me|rescue me|scared|natatakot|panic|panicking|lost|emergency|anong gagawin ko)\b/i

function isGeneralCrisis(text: string): boolean {
  return GENERAL_CRISIS_PATTERN.test(text)
}

function generalCrisisReply(text: string, context?: AssistantContext): string {
  const isTagalog = /\b(ano|anong|susunod|tulong|saklolo|natatakot|hindi|baha|lindol|bagyo|sunog|kuryente|ko|kami)\b/i.test(text)
  const town = context?.municipality ?? 'Marinduque'

  if (isTagalog) {
    return (
      '**AGAD-AGAD (Right Now)**\n' +
      '1. Huminto at huminga nang malalim. Suriin ang paligid: may gumuguho ba, tumataas na tubig, usok, o live na kuryente?\n' +
      '2. Pumunta agad sa pinakaligtas na lugar:\n' +
      '   - Kung baha: Umakyat sa pinakamataas na ligtas na palapag o mataas na lupa.\n' +
      '   - Kung lindol: Drop, Cover, and Hold On sa ilalim ng matibay na mesa.\n' +
      '   - Kung bagyo: Manatili sa pinakaloob na kwarto, malayo sa mga bintanang bubog.\n\n' +
      '**SUSUNOD NA HAKBANG (What to Do Next)**\n' +
      '1. Tingnan kung may nasugatan sa inyo. Idiin nang madiin ang malinis na tela kung may malakas na pagdurugo.\n' +
      '2. I-on ang Low Power Mode ng cellphone upang makatipid ng baterya kung walang kuryente.\n' +
      '3. Mag-text sa iyong pamilya o emergency contact ng iyong eksaktong barangay at sitwasyon (mas mabilis pumasok ang SMS kaysa tawag kapag mahina ang signal).\n' +
      '4. Makinig sa balita sa de-bateryang radyo.\n\n' +
      '**HUWAG GAWIN (What to Avoid)**\n' +
      '- Huwag lumusong o magmaneho sa umaagos na baha.\n' +
      '- Huwag magsindi ng posporo o lighter kung amoy gas.\n' +
      '- Huwag hawakan ang mga bumagsak na kable ng kuryente.\n\n' +
      `**TAWAGAN (Emergency Hotlines)**\n` +
      `- Pambansang Saklolo: 911\n` +
      `- ${town} MDRRMO / Pulis / Bumbero: Buksan ang Emergency tab sa app na ito para direktang tumawag.\n\n` +
      'Sabihin mo sa akin: Ligtas ka ba ngayon? Anong nangyayari sa paligid mo para maituro ko ang susunod na hakbang.'
    )
  }

  return (
    '**DO THIS RIGHT NOW**\n' +
    '1. Stop and take a deep breath. Scan your immediate surroundings for active hazards (falling debris, rising water, fire, live wires).\n' +
    '2. Move to the safest possible spot immediately:\n' +
    '   - If flooding: Move to the highest stable floor or ground.\n' +
    '   - If earthquake: Drop, Cover, and Hold On under a sturdy table.\n' +
    '   - If typhoon winds: Move to an interior room away from glass windows.\n\n' +
    '**WHAT TO DO NEXT**\n' +
    '1. Check yourself and companions for severe bleeding or injuries. Apply firm continuous pressure on cuts.\n' +
    '2. Switch your phone to Low Power Mode to conserve battery during island power cuts.\n' +
    '3. Send a brief SMS with your exact barangay and status to your emergency contact (SMS transmits better than voice on weak cellular signals).\n' +
    '4. Stay tuned to emergency radio bulletins.\n\n' +
    '**WHAT TO AVOID**\n' +
    '- Do not walk or drive through moving floodwaters.\n' +
    '- Do not light matches or use lighters if you smell gas or sewer odor.\n' +
    '- Do not touch downed electrical lines or flooded wall outlets.\n\n' +
    `**WHO TO CALL**\n` +
    `- National Emergency: 911\n` +
    `- ${town} MDRRMO / PNP / BFP: Open the Emergency tab in this app to dial directly.\n\n` +
    'Tell me: Are you safe right now? What is happening around you so I can guide your next step.'
  )
}

function formatGuideReply(guide: Guide, text: string, context?: AssistantContext): string {
  const town = context?.municipality ?? 'Marinduque'
  const isTagalog = /\b(ano|anong|susunod|tulong|saklolo|natatakot|hindi|baha|lindol|bagyo|sunog|kuryente|ko|kami)\b/i.test(text)
  const isAskingNext = /\b(next|susunod|after|pagkatapos|tapos)\b/i.test(text)
  const isAskingBefore = /\b(before|bago|prepare|maghanda|handa|kit|pack)\b/i.test(text)

  if (guide.kind === 'disaster') {
    const duringPhase = guide.phases.find((p) => p.label === 'During')
    const afterPhase = guide.phases.find((p) => p.label === 'After')
    const beforePhase = guide.phases.find((p) => p.label === 'Before')

    if (isAskingBefore && beforePhase) {
      const prepSteps = beforePhase.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
      const duringSteps = duringPhase ? duringPhase.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : ''
      return (
        `**${guide.name.toUpperCase()} PREPARATION (Paghahanda)**\n${prepSteps}\n\n` +
        (duringSteps ? `**WHEN DISASTER HITS (Kapag tumama)**\n${duringSteps}\n\n` : '') +
        `**EMERGENCY CONTACTS**\nCall 911 or ${town} MDRRMO. Open the Safety library in GabAI for full guides.`
      )
    }

    const immediateSteps = duringPhase ? duringPhase.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : ''
    const nextSteps = afterPhase ? afterPhase.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : ''

    if (isAskingNext && afterPhase) {
      return (
        `**WHAT TO DO NEXT (${guide.name.toUpperCase()})**\n${nextSteps}\n\n` +
        `**CRITICAL HAZARDS**\n` +
        `- Watch for secondary hazards (aftershocks, storm surge, landslides, downed power lines).\n` +
        `- Do not return to damaged structures until cleared by authorities.\n\n` +
        `**WHO TO CALL**\nCall 911 or ${town} MDRRMO.\n\n` +
        `Open the Safety library for full steps, or reply with what you need help with next.`
      )
    }

    return (
      `**DO THIS RIGHT NOW (${guide.name.toUpperCase()})**\n${immediateSteps}\n\n` +
      `**WHAT TO DO NEXT**\n${nextSteps}\n\n` +
      `**WHAT TO AVOID**\n` +
      `- Do not panic or rush into hazardous areas.\n` +
      `- Avoid downed electrical cables, floodwaters, and unstable walls.\n\n` +
      `**EMERGENCY CONTACTS**\n` +
      `Call 911 or ${town} MDRRMO (open the Emergency tab to dial directly).\n\n` +
      (isTagalog
        ? 'Sabihin mo sa akin kung ano ang kalagayan mo ngayon para maituro ko ang susunod na hakbang.'
        : 'Tell me what is happening around you right now so I can guide your next step.')
    )
  }

  // First aid guide
  const carePhase = guide.phases.find((p) => p.label === 'Immediate care' || p.label === 'Recognize and call') ?? guide.phases[0]
  const warnPhase = guide.phases.find((p) => p.label === 'Warning signs')
  const avoidPhase = guide.phases.find((p) => p.label === 'Avoid')

  const careSteps = carePhase.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
  const warnSteps = warnPhase ? warnPhase.steps.map((s, i) => `- ${s}`).join('\n') : ''
  const avoidSteps = avoidPhase ? avoidPhase.steps.map((s, i) => `- ${s}`).join('\n') : ''

  return (
    `**IMMEDIATE FIRST AID (${guide.name.toUpperCase()})**\n${careSteps}\n\n` +
    (warnSteps ? `**WARNING SIGNS & WHAT'S NEXT**\n${warnSteps}\n\n` : '') +
    (avoidSteps ? `**WHAT TO AVOID (Huwag Gawin)**\n${avoidSteps}\n\n` : '') +
    `**CALL FOR MEDICAL RESCUE**\n` +
    `For severe or life-threatening injuries, call 911 or ${town} MDRRMO immediately.\n\n` +
    `Keep the injured person still and calm. Tell me if their symptoms or condition changes.`
  )
}

const contactLine = (contacts: EmergencyContact[]) => contacts.map((contact) => `${contact.label} — ${contact.number}`).join('; ')

/**
 * Compact rendering of the bundled draft hotline dataset (`data/contacts.ts`), so every
 * backend — Gemini, a custom server, or the on-device model — quotes the same numbers.
 */
function directoryBlock(context?: AssistantContext): string {
  const municipal = MUNICIPALITIES.map((municipality) => {
    // Any later confirmed barangay rows ride along with the municipal list.
    const barangay = Object.values(barangayContacts[municipality] ?? {}).flat()
    return `${municipality}: ${contactLine([...barangay, ...municipalContacts[municipality]])}`
  })
  const lines = [
    'GabAI Marinduque hotline list (draft; confirm numbers with MDRRMO or the relevant office):',
    `National: ${contactLine(nationalContacts)}`,
    `Provincial: ${contactLine(provincialContacts)}`,
    ...municipal,
    'Barangay BDRRMC numbers are still pending MDRRMO verification — if asked for one, say it is not confirmed yet and give the municipal hotlines instead.',
  ]
  lines.push(...contextLines(context))
  lines.push('Answer contact questions only from this directory.')
  return lines.join('\n')
}

/** Profile facts a model may quote — the saved address and the user's own emergency contact. */
function contextLines(context?: AssistantContext): string[] {
  const lines: string[] = []
  if (context?.municipality) {
    lines.push(`User's saved address: ${context.barangay ? `Brgy. ${context.barangay}, ` : ''}${context.municipality}. Their municipal hotlines apply unless they ask about another place.`)
  }
  const contact = context?.emergencyContact
  if (contact) {
    lines.push(`User's personal emergency contact: ${contact.name}${contact.relationship ? ` (${contact.relationship})` : ''} — ${contact.phone}. Share it only when they ask about their own contact.`)
  }
  return lines
}

/**
 * The `searchContacts` matches rendered for a model prompt: only the hotlines that fit
 * the question, so even a small on-device model picks the right row instead of
 * hallucinating one from a long list.
 */
function focusedDirectoryBlock(search: ContactSearchResult, context?: AssistantContext): string {
  const lines = ['GabAI hotline list matching the question (draft; confirm numbers with MDRRMO or the relevant office):']
  for (const section of search.sections) {
    lines.push(`${section.title}${section.fallback ? ' (no dedicated hotline listed — closest responders)' : ''}: ${contactLine(section.contacts)}`)
  }
  lines.push(...contextLines(context))
  lines.push('Answer contact questions only from this directory. If the hotline the user needs is not listed, name the office to ask for (MDRRMO, BFP, PNP) — never invent a number.')
  return lines.join('\n')
}

/** The user's own emergency contact person, answered straight from their profile. */
function personalContactReply(question: string, context?: AssistantContext): string | null {
  if (!PERSONAL_CONTACT_TERMS.test(question)) return null
  const contact = context?.emergencyContact
  if (!contact) {
    return 'You have not saved a personal emergency contact yet — add one in Profile → Emergency contact. For official hotlines, tell me your municipality or agency.'
  }
  return `Your emergency contact: ${contact.name}${contact.relationship ? ` (${contact.relationship})` : ''} — ${contact.phone}\n\nFor official hotlines, ask me or open the Emergency contacts screen (red phone button).`
}

/**
 * No-model answer for "who do I call": deterministic text straight from the contacts
 * dataset, so a wrong number can never be generated. `searchContacts` narrows the
 * answer to the agency and place the question names. Returns null for other questions.
 */
export function contactReply(question: string, context?: AssistantContext): string | null {
  const text = question.toLowerCase()
  // Asking about the saved contact person counts as contact intent on its own.
  if (!wantsContacts(text) && !PERSONAL_CONTACT_TERMS.test(question)) return null
  const personal = personalContactReply(question, context)
  if (personal) return personal

  const search = searchContacts(question, context)
  const list = search.sections
    .map((section) => {
      const rows = section.contacts.map((contact) => `- ${contact.label}: ${contact.number}`).join('\n')
      return section.fallback ? `${section.title} (no dedicated hotline — closest responders)\n${rows}` : `${section.title}\n${rows}`
    })
    .join('\n\n')
  const barangayNote = /barangay|brgy|bdrrmc/.test(text)
    ? '\n\nBarangay BDRRMC numbers are still being verified — use the municipal hotlines meanwhile.'
    : ''
  const pointer = search.municipalities.length
    ? 'Open the Emergency contacts screen (red phone button) to call directly.'
    : `Tell me your municipality — ${MUNICIPALITIES.join(', ')} — for its local hotlines, or open the Emergency contacts screen to call directly.`
  return `${list}${barangayNote}\n\nThese numbers are a draft and need local verification. If possible, confirm them with the MDRRMO or relevant office. For immediate danger, call 911.\n\n${pointer}`
}

/**
 * Last-resort offline answer: contacts come straight from the dataset, otherwise
 * retrieves the best-matching bundled guide by keyword, or provides emergency triage.
 */
export function guideReply(question: string, context?: AssistantContext): string {
  const text = question.toLowerCase()
  if (KIT_TERMS.some((term) => text.includes(term))) return KIT_ANSWER
  const contacts = contactReply(question, context)
  if (contacts) return contacts

  const guide = findGuide(question)
  if (guide) {
    return formatGuideReply(guide, text, context)
  }

  if (isGeneralCrisis(text)) {
    return generalCrisisReply(text, context)
  }

  return FALLBACK
}

function buildSystem(question: string, length: ReplyLength, hasImage: boolean, hasAudio: boolean, context?: AssistantContext): string {
  // Guide retrieval is keyword-based; attached media needs its own task prompt.
  if (hasImage || hasAudio) {
    const prompt = hasImage ? VISION_PROMPT : AUDIO_PROMPT
    return `${prompt} ${LENGTH_PROMPT[length]}\n\n${directoryBlock(context)}`
  }
  const parts = [`${SYSTEM_PROMPT} ${LENGTH_PROMPT[length]}`]
  if (wantsDirectory(question)) {
    const search = searchContacts(question, context)
    parts.push(search.narrowed ? focusedDirectoryBlock(search, context) : directoryBlock(context))
  }
  const guide = findGuide(question)
  if (guide) {
    const reference = guide.phases.map((phase) => `${phase.label}: ${phase.steps.join(' ')}`).join('\n')
    parts.push(`Reference guide: ${guide.name}\n${reference}`)
  }
  return parts.join('\n\n')
}

type AssistantMedia = { image?: GeminiImage; imageUri?: string; audio?: GeminiAudio; audioUri?: string }
type ReplyStreamOptions = {
  signal?: AbortSignal
  onToken?: (token: string) => void
  onReset?: () => void
  onContext?: (usage: { usedTokens: number; maxTokens: number }) => void
  conversationId?: string
}

async function localReply(
  system: string,
  history: { role: 'user' | 'assistant'; text: string; imageUri?: string; audioUri?: string }[],
  nPredict: number,
  backend: LocalBackend,
  options: ReplyStreamOptions,
): Promise<{ text: string; usage: TokenUsage } | null> {
  if (!isLocalModelAvailable()) return null
  return generateLocal({ system, history, nPredict, backend, ...options })
}

/**
 * Dispatcher: cloud mode tries Gemini first, then falls back to the on-device
 * model and bundled-guide retrieval before any answer text is visible. A failure
 * after streaming starts is surfaced so the partial reply can be retried.
 * `usage` is set when a real model generated the reply (guide retrieval has no tokens).
 *
 * Images and voice messages use the multimodal Gemma/Gemini paths. If a local
 * model is unavailable, GabAI falls back to its bundled guides and hotline directory.
 */
export async function generateReply(
  question: string,
  history: ChatMessage[],
  settings: Settings,
  media?: AssistantMedia,
  context?: AssistantContext,
  options: ReplyStreamOptions = {},
): Promise<{ text: string; notice?: string; model?: string; usage?: TokenUsage & { source: UsageSource }; context?: { usedTokens: number; maxTokens: number } }> {
  let streamed = false
  const onToken = (token: string) => {
    if (!token) return
    streamed = true
    options.onToken?.(token)
  }
  if (options.signal?.aborted) return { text: '' }
  const image = media?.image
  const audio = media?.audio
  const imageUri = media?.imageUri
  const audioUri = media?.audioUri
  const system = buildSystem(question, settings.localReplyLength, Boolean(image || imageUri), Boolean(audio || audioUri), context)
  // Earlier photo messages keep their file in the bubble but are not re-sent each turn;
  // re-uploading every image per request would burn quota and latency.
  const modelHistory = history.slice(-HISTORY_LIMIT)
    .map((message) => ({ role: message.role, text: message.body }))
  const questionText = question || (image ? 'What can you tell me about this photo? Please keep me safe.' : '')
  const current: { role: 'user' | 'assistant'; text: string; image?: GeminiImage; audio?: GeminiAudio } = { role: 'user', text: questionText, image, audio }
  const nPredict = N_PREDICT[settings.localReplyLength]

  let notice: string | undefined
  if (settings.aiMode === 'cloud') {
    const apiKey = await getGeminiKey().catch(() => null)
    if (!apiKey) {
      notice = 'Cloud AI is not set up. Answered offline.'
    } else {
      try {
        const candidates = await resolveModelCandidates(apiKey, settings.geminiModel, {
          needsVision: Boolean(image),
          needsAudio: Boolean(audio),
          question,
          historyText: modelHistory.map((message) => message.text).join('\n'),
        })
        let lastError: unknown
        for (const [index, model] of candidates.entries()) {
          if (options.signal?.aborted) return { text: '' }
          try {
            const result = await generateGemini({ apiKey, model, system, history: [...modelHistory, current], signal: options.signal, onToken })
            if (index > 0) notice = `Switched to ${modelLabel(model)} after the first model was unavailable.`
            return { text: result.text, model, notice, usage: { source: 'gemini', ...result.usage } }
          } catch (candidateError) {
            lastError = candidateError
            const retryable = candidateError instanceof GeminiError && [404, 429, 500, 502, 503, 504].includes(candidateError.status ?? 0)
            if (retryable && candidateError instanceof GeminiError && candidateError.status) markGeminiModelUnavailable(apiKey, model, candidateError.status)
            if (streamed || !retryable) throw candidateError
          }
        }
        throw lastError ?? new GeminiError('No Gemini model is available for this request.', 'other')
      } catch (error) {
        if (options.signal?.aborted) return { text: '' }
        if (streamed) throw error
        notice = `${notice ? `${notice} ` : ''}${error instanceof GeminiError ? error.message : 'Gemini is unavailable.'} Answered offline.`
      }
    }
  } else if ((image || audio) && !isLocalModelAvailable()) {
    // Attachments are analyzed by the on-device model (voice on Android only) —
    // only warn when there is no engine or no downloaded model to try.
    notice = image
      ? 'Photo analysis needs the downloaded local model (Chat settings) or Cloud AI.'
      : 'Voice message analysis needs the local model or Cloud AI on this device.'
  }

  const localHistory = history.slice(-HISTORY_LIMIT).map((message) => ({
    role: message.role,
    text: message.body,
    imageUri: message.photo?.uri,
    audioUri: message.audio?.uri,
  }))
  localHistory.push({ role: 'user', text: questionText, imageUri, audioUri })
  let local: { text: string; usage: TokenUsage } | null = null
  try {
    local = await localReply(system, localHistory, nPredict, settings.localBackend, { ...options, onToken, conversationId: options.conversationId ?? 'main' })
  } catch (error) {
    if (options.signal?.aborted) return { text: '' }
    // Once a streamed answer is visible, don't replace it with another backend's reply.
    if (streamed) throw error
    notice = `${notice ? `${notice} ` : ''}${error instanceof Error ? error.message : 'Local AI is unavailable.'} Answered from the built-in guides.`
  }
  if (local) return { text: local.text, usage: { source: 'local', ...local.usage }, notice }
  if (audio && !notice) notice = 'Voice message analysis needs the local model or Cloud AI. Type your question or switch to Cloud AI.'
  // Without the on-device model, guide retrieval is the normal local answer — no nagging.
  const text = audio && !questionText.trim()
    ? 'I could not understand the voice message while offline. Please type your question, or switch to Cloud AI to analyze voice messages.'
    : guideReply(questionText || (image ? 'photo' : ''), context)
  onToken(text)
  return { text, notice }
}
