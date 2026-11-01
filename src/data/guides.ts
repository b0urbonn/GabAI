import type { IconName } from '@/components/ui/Icon'
import type { Tone } from '@/theme/tokens'

export type GuideKind = 'disaster' | 'aid'

export type GuidePhase = { label: string; steps: string[] }

export type Guide = {
  id: string
  kind: GuideKind
  name: string
  detail: string
  icon: IconName
  tone: Tone
  /** English and Filipino terms used for search and offline assistant retrieval. */
  keywords: string[]
  phases: GuidePhase[]
}

export const guides: Guide[] = [
  {
    id: 'typhoon',
    kind: 'disaster',
    name: 'Typhoon',
    detail: 'Before, during, and after a storm',
    icon: 'storm',
    tone: 'sky',
    keywords: ['typhoon', 'bagyo', 'storm', 'wind', 'hangin', 'signal', 'bumabagyo'],
    phases: [
      { label: 'Before', steps: ['Monitor PAGASA bulletins and local advisories.', 'Secure loose objects, reinforce windows, and trim weak branches.', 'Prepare a go-bag with water, food, medicine, a flashlight, and documents.'] },
      { label: 'During', steps: ['Stay indoors, away from windows and glass doors.', 'Evacuate immediately if authorities order it or your home is unsafe.', 'Unplug appliances and stay off wired phones during lightning.'] },
      { label: 'After', steps: ['Wait for the all-clear before going outside.', 'Stay away from fallen power lines and damaged structures.', 'Boil or treat drinking water until the supply is declared safe.'] },
    ],
  },
  {
    id: 'flood',
    kind: 'disaster',
    name: 'Flood',
    detail: 'Before, during, and after rising water',
    icon: 'flood',
    tone: 'blue',
    keywords: ['flood', 'baha', 'water', 'tubig', 'flash flood', 'binaha', 'bumabaha', 'lubog'],
    phases: [
      { label: 'Before', steps: ['Know your evacuation route and the nearest evacuation center.', 'Move valuables, documents, and electrical items to higher places.', 'Prepare a go-bag and keep your phone charged.'] },
      { label: 'During', steps: ['Move to higher ground as soon as water starts rising.', 'Do not walk or drive through floodwater; fast-moving water can knock you down.', 'Turn off electricity at the main switch only if it is safe to do so.'] },
      { label: 'After', steps: ['Return home only when authorities say it is safe.', 'Avoid floodwater; it may be contaminated or electrically charged.', 'Seek care for fever or muscle pain after wading, as these can be signs of leptospirosis.'] },
    ],
  },
  {
    id: 'landslide',
    kind: 'disaster',
    name: 'Landslide',
    detail: 'Before, during, and after sliding soil',
    icon: 'landslide',
    tone: 'amber',
    keywords: ['landslide', 'guho', 'pagguho', 'mudslide', 'slope', 'gumuho'],
    phases: [
      { label: 'Before', steps: ['Find out whether your area is landslide-prone from local hazard maps.', 'Watch for ground cracks, tilting trees, or sudden changes in creek water.', 'Plan an evacuation route away from slopes.'] },
      { label: 'During', steps: ['Evacuate immediately when you hear rumbling or see moving debris.', 'Move away from the path of the slide toward stable ground.', 'If escape is impossible, curl into a tight ball and protect your head.'] },
      { label: 'After', steps: ['Stay away from the slide area; more slides may follow.', 'Look for injured or trapped people from a safe distance and alert rescuers.', 'Report broken utility lines and damaged roads to authorities.'] },
    ],
  },
  {
    id: 'earthquake',
    kind: 'disaster',
    name: 'Earthquake',
    detail: 'Before, during, and after shaking',
    icon: 'quake',
    tone: 'violet',
    keywords: ['earthquake', 'lindol', 'quake', 'aftershock', 'tsunami', 'lumindol', 'yanig', 'yumanig'],
    phases: [
      { label: 'Before', steps: ['Secure heavy furniture and appliances to walls.', 'Identify safe spots under sturdy tables, away from windows.', 'Join earthquake drills and agree on a family meeting place.'] },
      { label: 'During', steps: ['Drop, Cover, and Hold On until the shaking stops.', 'Stay away from windows, shelves, and hanging objects.', 'If outdoors, move to an open area away from buildings, trees, and power lines.'] },
      { label: 'After', steps: ['Expect aftershocks; Drop, Cover, and Hold On again if shaking resumes.', 'Check yourself and others for injuries and give first aid.', 'If you are near the coast, move to high ground in case of a tsunami.'] },
    ],
  },
  {
    id: 'fire',
    kind: 'disaster',
    name: 'Fire',
    detail: 'Before, during, and after a fire',
    icon: 'fire',
    tone: 'coral',
    keywords: ['fire', 'sunog', 'smoke', 'usok', 'apoy'],
    phases: [
      { label: 'Before', steps: ['Install smoke alarms and keep a fire extinguisher within reach.', 'Never leave cooking unattended; keep flammables away from heat.', 'Plan and practice two ways out of every room.'] },
      { label: 'During', steps: ['Alert everyone and get out fast; call 911 once you are outside.', 'Stay low under smoke and cover your nose and mouth.', 'Feel doors before opening them; if hot, use another exit.'] },
      { label: 'After', steps: ['Do not go back inside until firefighters say it is safe.', 'Seek medical care for burns or smoke inhalation.', 'Contact your barangay for assistance and temporary shelter.'] },
    ],
  },
  {
    id: 'bleeding',
    kind: 'aid',
    name: 'Bleeding',
    detail: 'Step-by-step care for heavy bleeding',
    icon: 'bleeding',
    tone: 'rose',
    keywords: ['bleeding', 'blood', 'dugo', 'wound', 'sugat', 'cut'],
    phases: [
      { label: 'Immediate care', steps: ['Apply firm, direct pressure on the wound with a clean cloth.', 'Keep pressing for at least 10 minutes without lifting to check.', 'If blood soaks through, add more cloth on top and keep pressing.'] },
      { label: 'Warning signs', steps: ['Blood spurting, or not slowing after 10 minutes of pressure.', 'Pale, cold, clammy skin, confusion, or fainting.', 'Deep wounds, animal bites, or wounds from rusty objects.'] },
      { label: 'Avoid', steps: ['Do not remove embedded objects; pad around them instead.', 'Do not use a tourniquet unless trained and the bleeding is life-threatening.', 'Do not put powders, coffee, or herbs on the wound.'] },
    ],
  },
  {
    id: 'burns',
    kind: 'aid',
    name: 'Burns',
    detail: 'Step-by-step care for burns and scalds',
    icon: 'burn',
    tone: 'orange',
    keywords: ['burn', 'burns', 'paso', 'napaso', 'scald'],
    phases: [
      { label: 'Immediate care', steps: ['Cool the burn under cool running water for 20 minutes.', 'Remove rings and tight items before swelling starts.', 'Cover loosely with cling film or a clean, non-fluffy cloth.'] },
      { label: 'Warning signs', steps: ["Burns larger than the person's palm, or on the face, hands, feet, or groin.", 'Deep burns that look white, leathery, or charred.', 'Chemical or electrical burns, or any difficulty breathing.'] },
      { label: 'Avoid', steps: ['Do not apply ice, toothpaste, butter, or oil.', 'Do not pop blisters.', 'Do not remove clothing that is stuck to the burn.'] },
    ],
  },
  {
    id: 'fractures',
    kind: 'aid',
    name: 'Fractures',
    detail: 'Step-by-step care for broken bones',
    icon: 'fracture',
    tone: 'indigo',
    keywords: ['fracture', 'broken bone', 'bali', 'nabalian', 'nabali'],
    phases: [
      { label: 'Immediate care', steps: ['Keep the injured part still, in the position you found it.', 'Support it with padding or a splint above and below the injury.', 'Apply a cold pack wrapped in cloth to reduce swelling.'] },
      { label: 'Warning signs', steps: ['Bone visible through the skin, or severe deformity.', 'Numbness, tingling, or a cold, pale limb below the injury.', 'Suspected head, neck, or back injury: do not move the person.'] },
      { label: 'Avoid', steps: ['Do not try to straighten or push a bone back in.', 'Do not let the person walk on a suspected leg fracture.', 'Do not put ice directly on the skin.'] },
    ],
  },

  // Draft additions: references checked 2026-10-30; local medical/DRRM review required before release.
  // https://www.nhs.uk/conditions/sprains-and-strains/
  {
    id: 'sprains-strains',
    kind: 'aid',
    name: 'Sprains & strains',
    detail: 'Step-by-step care for twisted joints',
    icon: 'fracture',
    tone: 'teal',
    keywords: ['sprain', 'sprains', 'strain', 'strains', 'twisted ankle', 'pulled muscle', 'pilay', 'napilayan', 'natapilok'],
    phases: [
      { label: 'Immediate care', steps: ['For the first 2 to 3 days, protect the injury with a support and rest from activities that hurt; avoid putting weight on it.', 'Use a cold pack wrapped in cloth for up to 20 minutes every 2 to 3 hours.', 'Support with a bandage during the day and raise the injured area on a pillow.'] },
      { label: 'Warning signs', steps: ['Get urgent medical care for severe or worsening pain, swelling, or inability to walk more than a few steps.', 'A cracking sound, changed shape, numbness, or cold, blue or grey skin may mean a fracture: seek emergency care.'] },
      { label: 'Avoid', steps: ['Do not put ice directly on skin.', 'Avoid heat packs, hot baths, alcohol, and massage for the first couple of days.', 'Do not force painful movement. Resume gentle movement when pain allows.'] },
    ],
  },
  // https://www.redcross.org/take-a-class/cpr/performing-cpr/cpr-steps
  // https://guidelines.redcross.org/guidelines-database/cpr-techniques-and-sequence/
  {
    id: 'cpr-cardiac-arrest',
    kind: 'aid',
    name: 'CPR & cardiac arrest',
    detail: 'Step-by-step CPR and AED for adults',
    icon: 'heart',
    tone: 'rose',
    keywords: ['cpr', 'cardiac arrest', 'resuscitation', 'aed', 'unresponsive', 'not breathing', 'walang malay', 'hindi humihinga', 'tumigil ang puso'],
    phases: [
      { label: 'Recognize and call', steps: ['Make sure the area is safe. Check response and breathing for no more than 10 seconds.', 'For an adult who is unresponsive and not breathing normally or only gasping, call 911 on speaker and send someone for an AED. Begin CPR immediately.', 'These compression instructions are for adults. For a child or infant, follow age-specific CPR training and dispatcher instructions.'] },
      { label: 'Immediate care', steps: ['Lay the adult on their back on a firm, flat surface. Put both hands at the center of the chest, with straight arms.', 'Press 5 to 6 cm deep at 100 to 120 compressions per minute, letting the chest fully rise after each push.', 'If trained and able, alternate 30 compressions with 2 breaths lasting about 1 second each, enough to raise the chest. Otherwise, keep giving compressions and follow the dispatcher.', 'Use an AED as soon as available and follow its prompts. Continue until normal breathing returns, rescuers take over, you cannot continue, or the scene becomes unsafe.'] },
      { label: 'Avoid', steps: ['Do not mistake gasping for normal breathing or delay CPR.', 'Keep pauses brief. Nobody should touch the person during AED analysis or shock.'] },
    ],
  },
  // https://guidelines.redcross.org/guidelines-database/drowning-process-resuscitation/
  // https://www.moh.gov.sa/en/awarenessplateform/firstaid/pages/drowning.aspx
  {
    id: 'drowning',
    kind: 'aid',
    name: 'Drowning',
    detail: 'Step-by-step water rescue and recovery',
    icon: 'flood',
    tone: 'blue',
    keywords: ['drowning', 'drowned', 'near drowning', 'nalulunod', 'nalunod', 'pagkalunod', 'water rescue'],
    phases: [
      { label: 'Safe rescue', steps: ['Call 911 and alert rescuers. Reach with a pole or throw flotation from a safe place; do not enter dangerous water.', 'Once safely out, check response and normal breathing for no more than 10 seconds. Send someone for an AED.'] },
      { label: 'Immediate care', steps: ['If unresponsive and not breathing normally, trained rescuers should open the airway and give 2 initial rescue breaths, then cycles of 30 compressions and 2 breaths. Rescue breaths are especially important after drowning.', 'For an adult, press the center of the chest 5 to 6 cm at 100 to 120 pushes per minute. For children or infants, use age-specific CPR training and dispatcher instructions.', 'If unable to give breaths, start compressions and follow the dispatcher. Use an AED on dry ground after drying the chest; follow its prompts.', 'If unresponsive but breathing normally, place on their side and monitor breathing. Keep warm and get medical assessment even if they seem to recover.'] },
      { label: 'Avoid', steps: ['Do not try to drain water by hanging the person upside down or pressing their abdomen; this delays CPR.', 'Do not put yourself at risk in floodwater or delay CPR to fetch equipment.'] },
    ],
  },
]

export const disasterGuides = guides.filter((guide) => guide.kind === 'disaster')
export const firstAidGuides = guides.filter((guide) => guide.kind === 'aid')

export const getGuide = (id: string | undefined) => guides.find((guide) => guide.id === id)

export const guideKindLabel: Record<GuideKind, string> = { disaster: 'Disaster guide', aid: 'First aid guide' }
