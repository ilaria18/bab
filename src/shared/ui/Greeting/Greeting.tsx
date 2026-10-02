import { useEffect } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { HeadMascot } from '@/entities/avatar/Head'
import { useHeadWord } from '@/entities/avatar/headWord'
import { useWornHat } from '@/entities/avatar/wornHat'
import { useUserProfile } from '@/entities/user-profile/useUserProfile'
import { saveNotificationTitle } from '@/shared/lib/notificationTitle'
import './Greeting.css'

// the welcome layout stacks two lines of text, so its bar (and mascot) stays
// full size; the everyday one-line bar is slimmer to leave room for content
const MASCOT_WIDTH = 80
const MASCOT_HEIGHT = 50.3
const COMPACT_MASCOT_WIDTH = 68
const COMPACT_MASCOT_HEIGHT = 42.8

export const Greeting = ({ welcome = false }: { welcome?: boolean }) => {
  const { t } = useLingui()
  const { name } = useUserProfile()
  const displayName =
    name.trim() ||
    t({ message: 'Champ', comment: 'Friendly name the greeting uses until the user enters their own' })
  // the notifications greet her by name too (kept on the phone, see notificationTitle.ts)
  const notificationTitle = name.trim() ? t`Hi ${displayName}, BAB here` : null
  useEffect(() => {
    void saveNotificationTitle(notificationTitle)
  }, [notificationTitle])
  const { hatId } = useWornHat()
  const { headWordId } = useHeadWord()

  if (welcome) {
    return (
      <div className="app-greeting app-greeting--welcome">
        <div className="app-greeting-copy">
          <p className="app-greeting-hello">
            <Trans>Hi,</Trans>
          </p>
          <p className="app-greeting-name">{displayName}</p>
        </div>
        <HeadMascot className="app-greeting-cloud" hatId={hatId} wordId={headWordId} width={MASCOT_WIDTH} height={MASCOT_HEIGHT} />
      </div>
    )
  }

  return (
    <div className="app-greeting">
      <p className="app-greeting-text">
        <Trans>Hi, {displayName}</Trans>
      </p>
      <HeadMascot className="app-greeting-cloud" hatId={hatId} wordId={headWordId} width={COMPACT_MASCOT_WIDTH} height={COMPACT_MASCOT_HEIGHT} />
    </div>
  )
}
