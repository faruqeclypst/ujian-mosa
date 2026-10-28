import type { Transition, Variants } from 'framer-motion'

/*
 * Shared motion vocabulary for the whole app (ported from the Neon template, 2026-10-28). Every animation in
 * the kits and pages uses these variants and transitions instead of
 * local numbers, so motion feels like one system. UI motion is short
 * (0.2 to 0.35s); charts get the longer chartTransition (0.5 to 0.8s).
 * main.tsx wraps the app in MotionConfig reducedMotion="user",
 * so every animation here respects prefers-reduced-motion globally.
 */

export const uiTransition: Transition = { duration: 0.25, ease: 'easeOut' }

export const overlayTransition: Transition = { duration: 0.22, ease: 'easeOut' }

export const springPop: Transition = { type: 'spring', stiffness: 420, damping: 26 }

export const chartTransition: Transition = { duration: 0.65, ease: 'easeOut' }

/** Content rises a few pixels while fading in. Page panels and cards. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: uiTransition },
}

/** Parent for staggered children that each use fadeUp. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

/** Small scale settle for dialogs and menus opening from a point. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: overlayTransition },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: 'easeIn' } },
}

/** Backdrop fade for overlays, both directions. */
export const backdropFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}
