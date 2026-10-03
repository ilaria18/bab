/**
 * Brings the page back to its normal size after the athlete pinch-zoomed (e.g. on the body map).
 * Browsers keep a pinch-zoom for the whole page, so without this the next screens stay enlarged.
 * Zooming stays allowed: the viewport is capped at 1× only for a moment, which makes iPhone and
 * Android zoom back out, then the original setting is put back.
 */
export const resetPageZoom = (): void => {
  if (typeof window === 'undefined' || (window.visualViewport?.scale ?? 1) <= 1.01) return
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta) return
  const original = meta.content
  meta.content = `${original.replace(/,\s*maximum-scale=[^,]*/g, '')}, maximum-scale=1`
  window.setTimeout(() => {
    meta.content = original
  }, 400)
}
