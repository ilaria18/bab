/**
 * The space kept free for the phone's status bar (top) and navigation bar (bottom) comes from
 * env(safe-area-inset-*) — see --safe-top / --safe-bottom in index.css.
 *
 * Some Android phones (typically with the 3-button navigation bar) report the size of those bars
 * even though the installed web app is drawn *between* them, not under them. The space is then
 * counted twice: a big empty band under the tab bar and above the greeting.
 *
 * This checks whether the page really extends under the bars: if the page's height plus the
 * reported insets is no more than the screen's height, the bars sit outside the page and the
 * insets must be ignored. It sets --safe-area-inset-top/bottom (which index.css prefers over env())
 * to 0 in that case. Not used in the native app, where Capacitor sets those variables itself.
 */

const TOLERANCE_PX = 8

export type Insets = { top: number; bottom: number }

/** true when the reported insets describe bars the page is not actually drawn under */
export const insetsCountedTwice = (
  insets: Insets,
  viewport: { width: number; height: number },
  screenSize: { width: number; height: number },
): boolean => {
  if (insets.top + insets.bottom === 0) return false
  // screen.width/height don't swap with the orientation on every phone
  const portrait = viewport.height >= viewport.width
  const screenHeight = portrait
    ? Math.max(screenSize.width, screenSize.height)
    : Math.min(screenSize.width, screenSize.height)
  return viewport.height + insets.top + insets.bottom <= screenHeight + TOLERANCE_PX
}

/** the env(safe-area-inset-*) values, in CSS pixels */
const readEnvInsets = (doc: Document): Insets => {
  const probe = doc.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'
  doc.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const insets = { top: parseFloat(style.paddingTop) || 0, bottom: parseFloat(style.paddingBottom) || 0 }
  probe.remove()
  return insets
}

export const fixDoubleCountedInsets = (win: Window = window): void => {
  const apply = () => {
    const root = win.document.documentElement
    root.style.removeProperty('--safe-area-inset-top')
    root.style.removeProperty('--safe-area-inset-bottom')
    const insets = readEnvInsets(win.document)
    const twice = insetsCountedTwice(
      insets,
      { width: win.innerWidth, height: win.innerHeight },
      { width: win.screen.width, height: win.screen.height },
    )
    if (twice) {
      root.style.setProperty('--safe-area-inset-top', '0px')
      root.style.setProperty('--safe-area-inset-bottom', '0px')
    }
  }
  apply()
  win.addEventListener('resize', apply)
}
