export type BodyZone =
  | 'head'
  | 'neck'
  | 'pelvic'
  | 'trapLeft'
  | 'trapRight'
  | 'shoulderLeft'
  | 'shoulderRight'
  | 'upperArmLeft'
  | 'upperArmRight'
  | 'elbowLeft'
  | 'elbowRight'
  | 'forearmLeft'
  | 'forearmRight'
  | 'wristLeft'
  | 'wristRight'
  | 'handLeft'
  | 'handRight'
  | 'chestLeft'
  | 'chestRight'
  | 'ribsLeft'
  | 'ribsRight'
  | 'absLeft'
  | 'absRight'
  | 'upperBackLeft'
  | 'upperBackRight'
  | 'midBackLeft'
  | 'midBackRight'
  | 'lowerBackLeft'
  | 'lowerBackRight'
  | 'hipLeft'
  | 'hipRight'
  | 'gluteLeft'
  | 'gluteRight'
  | 'quadLeft'
  | 'quadRight'
  | 'hamstringLeft'
  | 'hamstringRight'
  | 'kneeLeft'
  | 'kneeRight'
  | 'shinLeft'
  | 'shinRight'
  | 'calfLeft'
  | 'calfRight'
  | 'ankleLeft'
  | 'ankleRight'
  | 'footLeft'
  | 'footRight'
  | 'heelLeft'
  | 'heelRight'
  /* the same parts seen from behind (back view): separate zones, so that tapping the
     front of a knee doesn't also mark the back of it */
  | 'headBack'
  | 'trapLeftBack'
  | 'trapRightBack'
  | 'shoulderLeftBack'
  | 'shoulderRightBack'
  | 'upperArmLeftBack'
  | 'upperArmRightBack'
  | 'elbowLeftBack'
  | 'elbowRightBack'
  | 'forearmLeftBack'
  | 'forearmRightBack'
  | 'wristLeftBack'
  | 'wristRightBack'
  | 'handLeftBack'
  | 'handRightBack'
  | 'kneeLeftBack'
  | 'kneeRightBack'
  | 'ankleLeftBack'
  | 'ankleRightBack'
  /** not localized to one body part — for words like "foggy" or "dizzy" */
  | 'whole'

/** How big the feeling is for this specific check-in — independent of
 * WordCard.intensity, which just shapes the word's default card art. */
export type CheckInIntensity = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/** Slider starts here so a user who never touches it still has a valid answer
 * and can move on — picking a value is optional, not a required interaction. */
export const DEFAULT_CHECK_IN_INTENSITY: CheckInIntensity = 5

/** Energy level on a 1 (empty) to 7 (full) scale. */
export type Energy = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const MIN_ENERGY = 1
export const MAX_ENERGY = 7

/** Slider starts here so a user who never touches it still has a valid answer. */
export const DEFAULT_ENERGY: Energy = 4

/** When the sensation shows up — surfaced right after "how big is it". More than one can apply. */
export type Trigger = 'movement' | 'pressure' | 'stillness'

export interface NewCheckInEntry {
  /** references WordDefinition.id from entities/word — content isn't duplicated here */
  wordId: string
  /** one or more zones tapped on the body map — non-empty once the location step is complete */
  bodyZones: BodyZone[]
  intensity: CheckInIntensity
  energy?: Energy
  triggers?: Trigger[]
  note?: string
}

export interface CheckInEntry extends NewCheckInEntry {
  id: string
  /** local calendar day, 'YYYY-MM-DD' — for grouping entries by day */
  date: string
  /** ISO datetime — for ordering entries within a day */
  createdAt: string
}
