import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type NeonButtonVariant = 'primary' | 'secondary' | 'soft' | 'outline' | 'dark' | 'danger' | 'dangerGhost' | 'ghost' | 'link'
export type NeonButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type NeonButtonColor =
  | 'brand'
  | 'sky'
  | 'amber'
  | 'purple'
  | 'rose'
  | 'neutral'
  | 'slate'
  | 'gray'
  | 'zinc'
  | 'stone'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'fuchsia'
  | 'pink'

/* NeonButton: the canonical button ported from the Neon template
   (owner decision, 2026-10-28: Examku aligns its components, skills,
   and motion to the template). One implementation with variants
   primary, secondary, soft, outline, dark, danger, dangerGhost,
   ghost, and link; a color prop covering the whole Tailwind core
   palette (brand is the emerald preset); sizes on the Tailwind UI
   padding ladder (xs to xl, no fixed heights); ring-1 ring-inset
   frames instead of borders; shadow-xs; a 2px outline focus with a
   2px offset colored per family; rounded-md corners.

   It coexists with the legacy shadcn Button in ./button during the
   migration: new surfaces use NeonButton, and existing pages move
   over page by page (see the alignment contract in AGENTS.md). The
   legacy Button stays untouched until its call sites are migrated.
   Adaptations for this repo: Tailwind v3 (no outline-solid utility),
   dark mode kept, surface mapped to white / neutral-850. */
/* The rose solid string is shared by the danger variant and the rose
   color preset: danger IS primary in rose, kept as a named variant
   because destructive actions name their meaning, not their color. */
const roseSolid =
  'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800 focus-visible:outline-rose-600 dark:hover:bg-rose-500 dark:active:bg-rose-600'

const variants: Record<'secondary' | 'dark' | 'danger' | 'dangerGhost', string> = {
  secondary: 'bg-white dark:bg-neutral-850 text-neutral-700 shadow-xs ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-emerald-600',
  dark: 'bg-neutral-900 text-white shadow-xs hover:bg-neutral-800 active:bg-neutral-950 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:active:bg-neutral-100',
  danger: roseSolid,
  dangerGhost: 'bg-white dark:bg-neutral-850 text-rose-600 shadow-xs ring-1 ring-inset ring-rose-300 hover:bg-rose-50 active:bg-rose-100 focus-visible:outline-rose-600',
}

/* The color dimension (prop `color`, default brand). Solid steps the
   official Tailwind ladder of its scale: 600 fill, 700 hover, 800
   active, 600 outline, with the dark fills named at 500 and 600. Soft
   is the 50 tint with 700 text and 100 hover. Amber solid is the one
   contrast exception: white on amber-600 fails, so the solid is
   amber-500 with neutral-950 text, a lighter amber-400 hover, and an
   amber-600 active and outline (recorded in design.md). Neutral soft
   steps 100 and 200 because neutral-50 is the page canvas itself. */
/* The six presets above the core set are the curated defaults. The
   remaining entries are the rest of the official Tailwind core
   palette, generated on the same ladder, so `color` accepts any
   color Tailwind supports; a project whose palette defines another
   scale adds it the same way (one line per map). Yellow and lime
   solids follow the amber contrast exception. */
const solidColors: Record<NeonButtonColor, string> = {
  brand: 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 focus-visible:outline-emerald-600 dark:hover:bg-emerald-500 dark:active:bg-emerald-600',
  sky: 'bg-sky-600 text-white shadow-xs hover:bg-sky-700 active:bg-sky-800 focus-visible:outline-sky-600 dark:hover:bg-sky-500 dark:active:bg-sky-600',
  amber: 'bg-amber-500 text-neutral-950 shadow-xs hover:bg-amber-400 active:bg-amber-600 focus-visible:outline-amber-600 dark:hover:bg-amber-400 dark:active:bg-amber-500',
  purple: 'bg-purple-600 text-white shadow-xs hover:bg-purple-700 active:bg-purple-800 focus-visible:outline-purple-600 dark:hover:bg-purple-500 dark:active:bg-purple-600',
  rose: roseSolid,
  neutral: 'bg-neutral-600 text-white shadow-xs hover:bg-neutral-700 active:bg-neutral-800 focus-visible:outline-neutral-600 dark:hover:bg-neutral-500 dark:active:bg-neutral-600',
  slate: 'bg-slate-600 text-white shadow-xs hover:bg-slate-700 active:bg-slate-800 focus-visible:outline-slate-600 dark:hover:bg-slate-500 dark:active:bg-slate-600',
  gray: 'bg-gray-600 text-white shadow-xs hover:bg-gray-700 active:bg-gray-800 focus-visible:outline-gray-600 dark:hover:bg-gray-500 dark:active:bg-gray-600',
  zinc: 'bg-zinc-600 text-white shadow-xs hover:bg-zinc-700 active:bg-zinc-800 focus-visible:outline-zinc-600 dark:hover:bg-zinc-500 dark:active:bg-zinc-600',
  stone: 'bg-stone-600 text-white shadow-xs hover:bg-stone-700 active:bg-stone-800 focus-visible:outline-stone-600 dark:hover:bg-stone-500 dark:active:bg-stone-600',
  red: 'bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800 focus-visible:outline-red-600 dark:hover:bg-red-500 dark:active:bg-red-600',
  orange: 'bg-orange-600 text-white shadow-xs hover:bg-orange-700 active:bg-orange-800 focus-visible:outline-orange-600 dark:hover:bg-orange-500 dark:active:bg-orange-600',
  yellow: 'bg-yellow-500 text-neutral-950 shadow-xs hover:bg-yellow-400 active:bg-yellow-600 focus-visible:outline-yellow-600 dark:hover:bg-yellow-400 dark:active:bg-yellow-500',
  lime: 'bg-lime-500 text-neutral-950 shadow-xs hover:bg-lime-400 active:bg-lime-600 focus-visible:outline-lime-600 dark:hover:bg-lime-400 dark:active:bg-lime-500',
  green: 'bg-green-600 text-white shadow-xs hover:bg-green-700 active:bg-green-800 focus-visible:outline-green-600 dark:hover:bg-green-500 dark:active:bg-green-600',
  emerald: 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 focus-visible:outline-emerald-600 dark:hover:bg-emerald-500 dark:active:bg-emerald-600',
  teal: 'bg-teal-600 text-white shadow-xs hover:bg-teal-700 active:bg-teal-800 focus-visible:outline-teal-600 dark:hover:bg-teal-500 dark:active:bg-teal-600',
  cyan: 'bg-cyan-600 text-white shadow-xs hover:bg-cyan-700 active:bg-cyan-800 focus-visible:outline-cyan-600 dark:hover:bg-cyan-500 dark:active:bg-cyan-600',
  blue: 'bg-blue-600 text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 focus-visible:outline-blue-600 dark:hover:bg-blue-500 dark:active:bg-blue-600',
  indigo: 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 focus-visible:outline-indigo-600 dark:hover:bg-indigo-500 dark:active:bg-indigo-600',
  violet: 'bg-violet-600 text-white shadow-xs hover:bg-violet-700 active:bg-violet-800 focus-visible:outline-violet-600 dark:hover:bg-violet-500 dark:active:bg-violet-600',
  fuchsia: 'bg-fuchsia-600 text-white shadow-xs hover:bg-fuchsia-700 active:bg-fuchsia-800 focus-visible:outline-fuchsia-600 dark:hover:bg-fuchsia-500 dark:active:bg-fuchsia-600',
  pink: 'bg-pink-600 text-white shadow-xs hover:bg-pink-700 active:bg-pink-800 focus-visible:outline-pink-600 dark:hover:bg-pink-500 dark:active:bg-pink-600',
}

const softColors: Record<NeonButtonColor, string> = {
  brand: 'bg-emerald-50 text-emerald-700 shadow-xs hover:bg-emerald-100 active:bg-emerald-100 focus-visible:outline-emerald-600',
  sky: 'bg-sky-50 text-sky-700 shadow-xs hover:bg-sky-100 active:bg-sky-100 focus-visible:outline-sky-600',
  amber: 'bg-amber-50 text-amber-700 shadow-xs hover:bg-amber-100 active:bg-amber-100 focus-visible:outline-amber-600',
  purple: 'bg-purple-50 text-purple-700 shadow-xs hover:bg-purple-100 active:bg-purple-100 focus-visible:outline-purple-600',
  rose: 'bg-rose-50 text-rose-700 shadow-xs hover:bg-rose-100 active:bg-rose-100 focus-visible:outline-rose-600',
  neutral: 'bg-neutral-100 text-neutral-700 shadow-xs hover:bg-neutral-200 active:bg-neutral-200 focus-visible:outline-neutral-600',
  slate: 'bg-slate-50 text-slate-700 shadow-xs hover:bg-slate-100 active:bg-slate-100 focus-visible:outline-slate-600',
  gray: 'bg-gray-50 text-gray-700 shadow-xs hover:bg-gray-100 active:bg-gray-100 focus-visible:outline-gray-600',
  zinc: 'bg-zinc-50 text-zinc-700 shadow-xs hover:bg-zinc-100 active:bg-zinc-100 focus-visible:outline-zinc-600',
  stone: 'bg-stone-50 text-stone-700 shadow-xs hover:bg-stone-100 active:bg-stone-100 focus-visible:outline-stone-600',
  red: 'bg-red-50 text-red-700 shadow-xs hover:bg-red-100 active:bg-red-100 focus-visible:outline-red-600',
  orange: 'bg-orange-50 text-orange-700 shadow-xs hover:bg-orange-100 active:bg-orange-100 focus-visible:outline-orange-600',
  yellow: 'bg-yellow-50 text-yellow-700 shadow-xs hover:bg-yellow-100 active:bg-yellow-100 focus-visible:outline-yellow-600',
  lime: 'bg-lime-50 text-lime-700 shadow-xs hover:bg-lime-100 active:bg-lime-100 focus-visible:outline-lime-600',
  green: 'bg-green-50 text-green-700 shadow-xs hover:bg-green-100 active:bg-green-100 focus-visible:outline-green-600',
  emerald: 'bg-emerald-50 text-emerald-700 shadow-xs hover:bg-emerald-100 active:bg-emerald-100 focus-visible:outline-emerald-600',
  teal: 'bg-teal-50 text-teal-700 shadow-xs hover:bg-teal-100 active:bg-teal-100 focus-visible:outline-teal-600',
  cyan: 'bg-cyan-50 text-cyan-700 shadow-xs hover:bg-cyan-100 active:bg-cyan-100 focus-visible:outline-cyan-600',
  blue: 'bg-blue-50 text-blue-700 shadow-xs hover:bg-blue-100 active:bg-blue-100 focus-visible:outline-blue-600',
  indigo: 'bg-indigo-50 text-indigo-700 shadow-xs hover:bg-indigo-100 active:bg-indigo-100 focus-visible:outline-indigo-600',
  violet: 'bg-violet-50 text-violet-700 shadow-xs hover:bg-violet-100 active:bg-violet-100 focus-visible:outline-violet-600',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-700 shadow-xs hover:bg-fuchsia-100 active:bg-fuchsia-100 focus-visible:outline-fuchsia-600',
  pink: 'bg-pink-50 text-pink-700 shadow-xs hover:bg-pink-100 active:bg-pink-100 focus-visible:outline-pink-600',
}

/* Outline is the colored frame: white fill, a 300 ring in the
   chosen color, and a 50 tint on hover. It is the emphasis step
   between soft and solid, for a colored action that must not
   shout. Neutral outline is the secondary frame with the brand
   focus outline, matching the ghost treatment. */
const outlineColors: Record<NeonButtonColor, string> = {
  brand: 'bg-white dark:bg-neutral-850 text-emerald-700 shadow-xs ring-1 ring-inset ring-emerald-300 hover:bg-emerald-50 active:bg-emerald-100 focus-visible:outline-emerald-600',
  sky: 'bg-white dark:bg-neutral-850 text-sky-700 shadow-xs ring-1 ring-inset ring-sky-300 hover:bg-sky-50 active:bg-sky-100 focus-visible:outline-sky-600',
  amber: 'bg-white dark:bg-neutral-850 text-amber-700 shadow-xs ring-1 ring-inset ring-amber-300 hover:bg-amber-50 active:bg-amber-100 focus-visible:outline-amber-600',
  purple: 'bg-white dark:bg-neutral-850 text-purple-700 shadow-xs ring-1 ring-inset ring-purple-300 hover:bg-purple-50 active:bg-purple-100 focus-visible:outline-purple-600',
  rose: 'bg-white dark:bg-neutral-850 text-rose-700 shadow-xs ring-1 ring-inset ring-rose-300 hover:bg-rose-50 active:bg-rose-100 focus-visible:outline-rose-600',
  neutral: 'bg-white dark:bg-neutral-850 text-neutral-700 shadow-xs ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-emerald-600',
  slate: 'bg-white dark:bg-neutral-850 text-slate-700 shadow-xs ring-1 ring-inset ring-slate-300 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-slate-600',
  gray: 'bg-white dark:bg-neutral-850 text-gray-700 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 active:bg-gray-100 focus-visible:outline-gray-600',
  zinc: 'bg-white dark:bg-neutral-850 text-zinc-700 shadow-xs ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 focus-visible:outline-zinc-600',
  stone: 'bg-white dark:bg-neutral-850 text-stone-700 shadow-xs ring-1 ring-inset ring-stone-300 hover:bg-stone-50 active:bg-stone-100 focus-visible:outline-stone-600',
  red: 'bg-white dark:bg-neutral-850 text-red-700 shadow-xs ring-1 ring-inset ring-red-300 hover:bg-red-50 active:bg-red-100 focus-visible:outline-red-600',
  orange: 'bg-white dark:bg-neutral-850 text-orange-700 shadow-xs ring-1 ring-inset ring-orange-300 hover:bg-orange-50 active:bg-orange-100 focus-visible:outline-orange-600',
  yellow: 'bg-white dark:bg-neutral-850 text-yellow-700 shadow-xs ring-1 ring-inset ring-yellow-300 hover:bg-yellow-50 active:bg-yellow-100 focus-visible:outline-yellow-600',
  lime: 'bg-white dark:bg-neutral-850 text-lime-700 shadow-xs ring-1 ring-inset ring-lime-300 hover:bg-lime-50 active:bg-lime-100 focus-visible:outline-lime-600',
  green: 'bg-white dark:bg-neutral-850 text-green-700 shadow-xs ring-1 ring-inset ring-green-300 hover:bg-green-50 active:bg-green-100 focus-visible:outline-green-600',
  emerald: 'bg-white dark:bg-neutral-850 text-emerald-700 shadow-xs ring-1 ring-inset ring-emerald-300 hover:bg-emerald-50 active:bg-emerald-100 focus-visible:outline-emerald-600',
  teal: 'bg-white dark:bg-neutral-850 text-teal-700 shadow-xs ring-1 ring-inset ring-teal-300 hover:bg-teal-50 active:bg-teal-100 focus-visible:outline-teal-600',
  cyan: 'bg-white dark:bg-neutral-850 text-cyan-700 shadow-xs ring-1 ring-inset ring-cyan-300 hover:bg-cyan-50 active:bg-cyan-100 focus-visible:outline-cyan-600',
  blue: 'bg-white dark:bg-neutral-850 text-blue-700 shadow-xs ring-1 ring-inset ring-blue-300 hover:bg-blue-50 active:bg-blue-100 focus-visible:outline-blue-600',
  indigo: 'bg-white dark:bg-neutral-850 text-indigo-700 shadow-xs ring-1 ring-inset ring-indigo-300 hover:bg-indigo-50 active:bg-indigo-100 focus-visible:outline-indigo-600',
  violet: 'bg-white dark:bg-neutral-850 text-violet-700 shadow-xs ring-1 ring-inset ring-violet-300 hover:bg-violet-50 active:bg-violet-100 focus-visible:outline-violet-600',
  fuchsia: 'bg-white dark:bg-neutral-850 text-fuchsia-700 shadow-xs ring-1 ring-inset ring-fuchsia-300 hover:bg-fuchsia-50 active:bg-fuchsia-100 focus-visible:outline-fuchsia-600',
  pink: 'bg-white dark:bg-neutral-850 text-pink-700 shadow-xs ring-1 ring-inset ring-pink-300 hover:bg-pink-50 active:bg-pink-100 focus-visible:outline-pink-600',
}

/* Ghost and link take a color only when `color` is passed explicitly;
   without it they keep the exact rendering they had before the color
   dimension existed (neutral ghost, brand link), so no existing
   surface shifts. */
const ghostColors: Record<NeonButtonColor, string> = {
  brand: 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100 focus-visible:outline-emerald-600',
  sky: 'text-sky-700 hover:bg-sky-50 hover:text-sky-800 active:bg-sky-100 focus-visible:outline-sky-600',
  amber: 'text-amber-700 hover:bg-amber-50 hover:text-amber-800 active:bg-amber-100 focus-visible:outline-amber-600',
  purple: 'text-purple-700 hover:bg-purple-50 hover:text-purple-800 active:bg-purple-100 focus-visible:outline-purple-600',
  rose: 'text-rose-700 hover:bg-rose-50 hover:text-rose-800 active:bg-rose-100 focus-visible:outline-rose-600',
  neutral: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 focus-visible:outline-emerald-600',
  slate: 'text-slate-700 hover:bg-slate-50 hover:text-slate-800 active:bg-slate-100 focus-visible:outline-slate-600',
  gray: 'text-gray-700 hover:bg-gray-50 hover:text-gray-800 active:bg-gray-100 focus-visible:outline-gray-600',
  zinc: 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-800 active:bg-zinc-100 focus-visible:outline-zinc-600',
  stone: 'text-stone-700 hover:bg-stone-50 hover:text-stone-800 active:bg-stone-100 focus-visible:outline-stone-600',
  red: 'text-red-700 hover:bg-red-50 hover:text-red-800 active:bg-red-100 focus-visible:outline-red-600',
  orange: 'text-orange-700 hover:bg-orange-50 hover:text-orange-800 active:bg-orange-100 focus-visible:outline-orange-600',
  yellow: 'text-yellow-700 hover:bg-yellow-50 hover:text-yellow-800 active:bg-yellow-100 focus-visible:outline-yellow-600',
  lime: 'text-lime-700 hover:bg-lime-50 hover:text-lime-800 active:bg-lime-100 focus-visible:outline-lime-600',
  green: 'text-green-700 hover:bg-green-50 hover:text-green-800 active:bg-green-100 focus-visible:outline-green-600',
  emerald: 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100 focus-visible:outline-emerald-600',
  teal: 'text-teal-700 hover:bg-teal-50 hover:text-teal-800 active:bg-teal-100 focus-visible:outline-teal-600',
  cyan: 'text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800 active:bg-cyan-100 focus-visible:outline-cyan-600',
  blue: 'text-blue-700 hover:bg-blue-50 hover:text-blue-800 active:bg-blue-100 focus-visible:outline-blue-600',
  indigo: 'text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 active:bg-indigo-100 focus-visible:outline-indigo-600',
  violet: 'text-violet-700 hover:bg-violet-50 hover:text-violet-800 active:bg-violet-100 focus-visible:outline-violet-600',
  fuchsia: 'text-fuchsia-700 hover:bg-fuchsia-50 hover:text-fuchsia-800 active:bg-fuchsia-100 focus-visible:outline-fuchsia-600',
  pink: 'text-pink-700 hover:bg-pink-50 hover:text-pink-800 active:bg-pink-100 focus-visible:outline-pink-600',
}

const linkColors: Record<NeonButtonColor, string> = {
  brand: 'text-emerald-700 underline-offset-4 hover:underline active:text-emerald-800 focus-visible:outline-emerald-600',
  sky: 'text-sky-700 underline-offset-4 hover:underline active:text-sky-800 focus-visible:outline-sky-600',
  amber: 'text-amber-700 underline-offset-4 hover:underline active:text-amber-800 focus-visible:outline-amber-600',
  purple: 'text-purple-700 underline-offset-4 hover:underline active:text-purple-800 focus-visible:outline-purple-600',
  rose: 'text-rose-700 underline-offset-4 hover:underline active:text-rose-800 focus-visible:outline-rose-600',
  neutral: 'text-neutral-700 underline-offset-4 hover:underline active:text-neutral-900 focus-visible:outline-neutral-600',
  slate: 'text-slate-700 underline-offset-4 hover:underline active:text-slate-800 focus-visible:outline-slate-600',
  gray: 'text-gray-700 underline-offset-4 hover:underline active:text-gray-800 focus-visible:outline-gray-600',
  zinc: 'text-zinc-700 underline-offset-4 hover:underline active:text-zinc-800 focus-visible:outline-zinc-600',
  stone: 'text-stone-700 underline-offset-4 hover:underline active:text-stone-800 focus-visible:outline-stone-600',
  red: 'text-red-700 underline-offset-4 hover:underline active:text-red-800 focus-visible:outline-red-600',
  orange: 'text-orange-700 underline-offset-4 hover:underline active:text-orange-800 focus-visible:outline-orange-600',
  yellow: 'text-yellow-700 underline-offset-4 hover:underline active:text-yellow-800 focus-visible:outline-yellow-600',
  lime: 'text-lime-700 underline-offset-4 hover:underline active:text-lime-800 focus-visible:outline-lime-600',
  green: 'text-green-700 underline-offset-4 hover:underline active:text-green-800 focus-visible:outline-green-600',
  emerald: 'text-emerald-700 underline-offset-4 hover:underline active:text-emerald-800 focus-visible:outline-emerald-600',
  teal: 'text-teal-700 underline-offset-4 hover:underline active:text-teal-800 focus-visible:outline-teal-600',
  cyan: 'text-cyan-700 underline-offset-4 hover:underline active:text-cyan-800 focus-visible:outline-cyan-600',
  blue: 'text-blue-700 underline-offset-4 hover:underline active:text-blue-800 focus-visible:outline-blue-600',
  indigo: 'text-indigo-700 underline-offset-4 hover:underline active:text-indigo-800 focus-visible:outline-indigo-600',
  violet: 'text-violet-700 underline-offset-4 hover:underline active:text-violet-800 focus-visible:outline-violet-600',
  fuchsia: 'text-fuchsia-700 underline-offset-4 hover:underline active:text-fuchsia-800 focus-visible:outline-fuchsia-600',
  pink: 'text-pink-700 underline-offset-4 hover:underline active:text-pink-800 focus-visible:outline-pink-600',
}

const plainGhost = 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 focus-visible:outline-emerald-600'
const plainLink = linkColors.brand

/* The Tailwind UI size ladder: padding and text size step together,
   font-semibold throughout (xs is text-xs, the rest text-sm). */
const sizes: Record<NeonButtonSize, string> = {
  xs: 'gap-1 px-2 py-1 text-xs',
  sm: 'gap-1.5 px-2.5 py-1.5 text-sm',
  md: 'gap-1.5 px-3 py-2 text-sm',
  lg: 'gap-2 px-3.5 py-2.5 text-sm',
  xl: 'gap-2 px-4 py-2.5 text-sm',
}

const iconOnlySizes: Record<NeonButtonSize, string> = {
  xs: 'p-1',
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
  xl: 'p-2.5',
}

export interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeonButtonVariant
  /** Color of the primary, soft, outline, ghost, and link variants. Secondary,
      dark, danger, and dangerGhost carry their color in their name and
      ignore this prop; danger is the rose preset of primary. */
  color?: NeonButtonColor
  size?: NeonButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  /** Square padding for a button that carries only an icon. */
  iconOnly?: boolean
}

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(function NeonButton(
  { variant = 'primary', color, size = 'md', loading, disabled, icon, iconRight, iconOnly = false, className = '', children, ...rest },
  ref,
) {
  /* The runtime fallback keeps the tolerance the old neon API had:
     an unknown size string renders as md instead of unstyled. */
  const sizeKey = (size in sizes ? size : 'md') as NeonButtonSize
  const colorKey = (color && color in solidColors ? color : 'brand') as NeonButtonColor
  const variantClass =
    variant === 'primary'
      ? solidColors[colorKey]
      : variant === 'soft'
        ? softColors[colorKey]
        : variant === 'outline'
          ? outlineColors[colorKey]
          : variant === 'ghost'
            ? color
              ? ghostColors[colorKey]
              : plainGhost
            : variant === 'link'
              ? color
                ? linkColors[colorKey]
                : plainLink
              : variants[variant]
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center rounded-md font-semibold whitespace-nowrap transition-colors duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 disabled:shadow-none ${variantClass} ${iconOnly ? iconOnlySizes[sizeKey] : sizes[sizeKey]} ${className}`}
      {...rest}
    >
      {loading ? <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
      {iconRight}
    </button>
  )
})
