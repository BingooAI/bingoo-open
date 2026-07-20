/**
 * One source of truth for the "chrome" of HUD chips that overlay content —
 * reused by CoinCounter, ComboMeter, CountdownTimer, LeagueTier… so a stat pill
 * looks identical whether it sits in a lesson card, a game HUD, a TikTok-style
 * feed, or an arena. `onMedia` switches to a glass look that reads on any media.
 */
export function hudSurfaceClass(onMedia?: boolean): string {
  return onMedia
    ? 'bg-black/35 text-white backdrop-blur-md border border-white/15'
    : 'bg-surface text-foreground border border-border'
}
