---
name: "The Saint Promisse — TP Fichas"
description: "A shared campaign workspace for character sheets and live RPG play."
colors:
  background: "hsl(265 28% 6%)"
  foreground: "hsl(270 20% 96%)"
  card: "hsl(265 25% 9%)"
  card-foreground: "hsl(270 18% 96%)"
  popover: "hsl(265 28% 8%)"
  popover-foreground: "hsl(270 18% 96%)"
  primary: "hsl(268 85% 62%)"
  primary-foreground: "hsl(270 30% 98%)"
  secondary: "hsl(265 18% 14%)"
  secondary-foreground: "hsl(270 14% 92%)"
  muted: "hsl(265 14% 16%)"
  muted-foreground: "hsl(270 10% 68%)"
  accent: "hsl(42 78% 58%)"
  accent-foreground: "hsl(265 40% 8%)"
  destructive: "hsl(0 72% 50%)"
  destructive-foreground: "hsl(0 0% 100%)"
  border: "hsl(268 22% 18%)"
  input: "hsl(268 22% 16%)"
  ring: "hsl(268 85% 62%)"
  hp: "hsl(0 75% 55%)"
  pe: "hsl(268 85% 62%)"
  shield-color: "hsl(220 60% 60%)"
  neon-green: "hsl(150 70% 55%)"
  neon-red: "hsl(0 75% 55%)"
  neon-yellow: "hsl(42 90% 60%)"
  neon-orange: "hsl(25 90% 60%)"
  relic: "hsl(0 66% 32%)"
  relic-deep: "hsl(0 70% 8%)"
  dice-veil-violet: "hsl(268 70% 25% / 0.55)"
  dice-veil-gold: "hsl(42 50% 20% / 0.25)"
  dice-result-chip-start: "hsl(268 60% 22%)"
  dice-result-chip-end: "hsl(285 55% 18%)"
  dice-result-chip-foreground: "hsl(42 90% 75%)"
  dice-bonus-chip-start: "hsl(42 60% 22%)"
  dice-bonus-chip-end: "hsl(38 55% 16%)"
  dice-bonus-chip-foreground: "hsl(42 90% 78%)"
  dice-total-foreground: "hsl(42 90% 70%)"
  map-background-tint: "#a3e3ff"
  splash-flash-start: "hsla(270, 100%, 50%, 0.9)"
  splash-flash-middle: "hsla(270, 100%, 50%, 0.5)"
typography:
  display:
    fontFamily: "Cinzel Decorative, Cinzel, serif"
    letterSpacing: "0.06em"
  headline:
    fontFamily: "Cinzel, serif"
    letterSpacing: "0.06em"
  body:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontWeight: 500
  label:
    fontFamily: "JetBrains Mono, monospace"
  splashInstruction:
    fontFamily: "Inter, system-ui, sans-serif"
    fontWeight: 500
    minFontSize: "16px"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-mystic:
    backgroundColor: "var(--gradient-mystic)"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-gold:
    backgroundColor: "var(--gradient-gold)"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  input:
    backgroundColor: "hsl(var(--background) / 0.6)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "linear-gradient(145deg, hsl(265 25% 10%), hsl(270 28% 7%))"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-mystic:
    backgroundColor: "hsl(var(--primary) / 0.15)"
    textColor: "{colors.primary}"
    rounded: "999px"
    padding: "2px 10px"
  nav-active:
    backgroundColor: "hsl(var(--primary) / 0.15)"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
---

# Design System: The Saint Promisse — TP Fichas

## Overview

**Creative North Star: "atlas astral da campanha"**

The visual language turns the campaign workspace into an astral atlas: deep violet surfaces, a restrained gold secondary accent, ceremonial type, and subtle orbital geometry. It preserves the existing dark, mystical identity while making navigation and player resources easier to scan.

The experience is organized around play rather than a marketing page. A 64px module bar and session log frame the selected RPG workspace; module-specific content uses a shared family of controls and surfaces. Low-contrast coordinate lines, orbit arcs, and radial gradients stay behind interactive content. The interface remains information-dense, with clear type roles for headings, reading text, and numeric or system data.

**Key Characteristics:**
- Dark HSL surfaces with violet primary and a restrained gold accent.
- Subtle atlas grid and orbit arcs behind panels, never over text or controls.
- Cinzel-family headings, Cormorant Garamond reading text, and JetBrains Mono data labels.
- A 64px module bar, role-aware primary tabs, a collapsible 256px session log, and specialized RPG workspaces.
- An absolute 14px text floor; reading copy and actionable controls are at least 16px.
- Layered panels and shadows, with glow reserved for actions and active emphasis.

## Colors

The palette is defined with HSL custom properties in the global stylesheet; these semantic token names are the source of truth.

### Primary
- **primary**: Main actions, selected navigation, focus rings, and the principal glow.
- **primary-foreground**: Text and icons placed on primary actions.
- **ring**: Keyboard focus and other visible focus states.

### Secondary
- **accent**: Secondary emphasis, gold-gradient actions, and ornamental separators.
- **accent-foreground**: Text on accent surfaces.
- **secondary**: Interactive hover surfaces and subdued plum panels.
- **secondary-foreground**: Content on secondary surfaces.

### Tertiary
- **hp**, **pe**, and **shield-color**: RPG resource indicators.
- **neon-green**, **neon-red**, **neon-yellow**, and **neon-orange**: Status and gameplay emphasis.
- **relic** and **relic-deep**: Relic and dramatic request surfaces.

### Neutral
- **background** and **foreground**: Global canvas and default text.
- **card** and **card-foreground**: Main panel surface and its content.
- **popover** and **popover-foreground**: Floating menus and dialogs.
- **muted** and **muted-foreground**: Quiet surfaces, secondary copy, and supporting details.
- **border** and **input**: Dividers, outlines, and field boundaries.
- **destructive** and **destructive-foreground**: Destructive actions and their text.

**The Semantic Palette Rule.** Use the existing token for each action, surface, and RPG resource role. Keep the CSS custom properties as the color source of truth.

### Component accents

The component-specific CSS properties below preserve existing highlights while keeping their values centralized:

- `--dice-veil-violet` and `--dice-veil-gold`: light layers behind the 3D dice.
- `--dice-result-chip-start`, `--dice-result-chip-end`, and `--dice-result-chip-foreground`: result chips.
- `--dice-bonus-chip-start`, `--dice-bonus-chip-end`, and `--dice-bonus-chip-foreground`: bonus chips.
- `--dice-total-foreground`: the total in the dice summary.
- `--map-background-tint`: the map background control.
- `--splash-flash-start` and `--splash-flash-middle`: the entry flash.

## Typography

**Display Font:** Cinzel Decorative, with Cinzel and serif fallbacks
**Body Font:** Cormorant Garamond, with Georgia and serif fallbacks
**Label/Mono Font:** JetBrains Mono, with a monospace fallback
**Splash instruction exception:** Inter/system-ui sans is limited to the welcome keyboard and click guidance.

**Character:** Cinzel Decorative gives the main headings a ceremonial voice; Cinzel carries module and navigation labels. Cormorant Garamond handles reading copy, while JetBrains Mono makes logs and numeric details distinct.

### Hierarchy
- **Display:** Cinzel Decorative; used by the global heading styles and the RPG splash title.
- **Headline:** Cinzel; used by module headings, navigation, and shared card titles.
- **Body:** Cormorant Garamond at weight 500; used by the global body and descriptive copy.
- **Label:** JetBrains Mono; used for logs, timestamps, and data-oriented details. Global `text-xs` is 14px and `text-sm` is 16px.

**The Type-by-Role Rule.** Keep display, reading, and data typography in their established roles; the global font links load these families from Google Fonts.

### Absolute Type Floor

All visible interface text is at least 14 CSS px. Reading copy and actionable controls are at least 16 CSS px. Canvas labels account for zoom so their effective on-screen size respects the same floor.

## Layout

The shell uses a fixed 64px top bar. On desktop, the session log occupies a 256px left rail or a 40px collapsed rail; the main workspace spans the remaining width, with its top and left offsets accounting for the persistent chrome. Primary module tabs vary by role to keep the header readable, with remaining routes in the “Módulos” menu.

Modules supply their own internal layouts. The shell adds a compact zoom control and a floating dice action near the lower-right edge. The map can enter an immersive mode that hides the normal shell. At narrow widths, the log collapses automatically and the module bar remains horizontally scrollable.

## Elevation & Depth

The system is layered: dark tonal surfaces and fine borders define panels, while deep shadows separate the persistent chrome from the workspace. Violet and gold glows distinguish primary actions, selected navigation, and emphasized module icons. The header also uses backdrop blur; the global card treatments combine gradients with an inset highlight.

### Shadow Vocabulary
- **shadow-occult**: Deep separation beneath dark panels; the card treatment pairs it with a subtle inset edge.
- **shadow-mystic**: Violet ambient shadow paired with a fine tinted outline.
- **shadow-glow**: Soft violet halo for selected or emphasized elements.

**The Focused-Glow Rule.** Keep the underlying panels dark and layered; use the brighter glows to identify actions, selection, or emphasis.

## Shapes

The shared corner scale is gently rounded: 6px small, 8px medium, 10px large, and 14px extra-large. Buttons, inputs, chips, and navigation use compact rounded rectangles; badges and counts use pill shapes. Borders are thin and low-contrast, with a narrow gold divider used as a recurring ornament.

## Components

Shared controls provide the base; each RPG module adds the information and actions specific to its workflow.

### Buttons
- **Shape:** Compact rounded rectangle (8px on the common medium size).
- **Mystic primary:** Violet gradient, light foreground, 40px default height, and a violet shadow. Hover strengthens the glow and lifts the control slightly.
- **Gold:** Gold gradient for important confirmations and completion actions; hover increases the gold glow.
- **Outline and secondary:** Dark card or plum surface with a thin border; hover shifts the surface and may add a soft violet edge.
- **Focus and disabled:** Visible two-pixel focus ring with offset; disabled controls reduce opacity and stop accepting pointer input.

### Chips
- **Style:** Compact pill badge. The mystic variant uses a translucent primary surface, primary text, and a thin border.
- **State:** Default, secondary, destructive, outline, and mystic variants are present.

### Cards / Containers
- **Corner Style:** Rounded 10px panels.
- **Background:** Dark plum gradient over the global background.
- **Shadow Strategy:** Deep shadow with a subtle inset highlight; some variants add a translucent veil and blur.
- **Border:** Thin semantic border, sometimes tinted toward primary.
- **Internal Padding:** Shared card header and content use 24px padding.

### Inputs / Fields
- **Style:** Full-width dark field with a thin border, medium 8px corner, and 12px horizontal padding.
- **Focus:** Primary border shift, two-pixel focus ring, and a restrained violet shadow.
- **Error / Disabled:** Destructive state is available; disabled fields reduce opacity and use a not-allowed cursor.

### Navigation
- **Style:** Fixed 64px top bar with Cinzel labels and icons. Four primary tabs are shown to the Master and five to Players; remaining routes are available from the “Módulos” menu. The order remains configurable.
- **Active:** Translucent primary surface, violet border and glow, plus a fine gold underline.
- **Inactive / Hover:** Muted text becomes foreground text over a secondary surface.
- **Responsive:** Keep the tab strip scrollable; the log panel collapses on narrow screens.

### Module Header
A shared module heading uses a bordered 40px icon tile, a Cinzel title, an optional monospace status or count, italic Cormorant description, and right-aligned actions.

### Session Log
The left panel uses colored event icons, compact monospaced messages, and monospaced timestamps. It can collapse to a 40px rail; the empty state uses centered italic body text.

## Do's and Don'ts

### Do:
- **Do** use the existing semantic tokens for global surfaces, actions, and RPG resource states.
- **Do** preserve the display, reading, and monospace typography roles.
- **Do** keep all interface text at or above 14px, and reading text and actionable controls at or above 16px.
- **Do** build module-specific interfaces from the shared buttons, fields, cards, badges, and module header.
- **Do** keep keyboard focus visible and preserve active, hover, and disabled states.

### Don't:
- **Don't** replace the dark global canvas with a light surface while documenting or extending this visual system.
- **Don't** remove the contrast between deep panels and active violet or gold emphasis.
- **Don't** spread the quest-board parchment asset across the app shell; its current use is a localized surface.
