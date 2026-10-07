---
name: 旅用
description: Saved social-media places become photo cards, and photo cards become a day you can walk.
colors:
  bg: "#F6F5F1"
  surface: "#FFFFFF"
  fill: "#F0EFEA"
  fill-2: "#E6E4DD"
  ink: "#1C1F1D"
  ink-2: "#434A46"
  muted: "#69706C"
  line: "#E7E5DF"
  green: "#1F5C45"
  green-hover: "#184C39"
  green-ink: "#FFFFFF"
  green-tint: "#E6F0EA"
  green-text: "#1F6B4E"
  amber: "#A85F0C"
  amber-tint: "#FFF3DD"
  heart: "#E5484D"
  danger: "#C2352E"
  scrim: "rgb(20 24 22 / .46)"
  map-land: "#F3F0E8"
  map-grid: "#E7E3D8"
  c-food-bg: "#FDEDDF"
  c-food: "#A64B05"
  c-cafe-bg: "#F4ECE2"
  c-cafe: "#855731"
  c-sight-bg: "#E3F2E7"
  c-sight: "#237043"
  c-shopping-bg: "#FCE6EE"
  c-shopping: "#B82E5E"
  c-stay-bg: "#E4EDFA"
  c-stay: "#285FA8"
  c-experience-bg: "#EEE7FA"
  c-experience: "#6A47BC"
  c-nightlife-bg: "#E7E8FA"
  c-nightlife: "#4549B5"
  c-transport-bg: "#E4EDF2"
  c-transport: "#335F75"
  c-other-bg: "#EDEDEA"
  c-other: "#575C59"
typography:
  display:
    fontFamily: "Figtree, Noto Sans SC, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Figtree, Noto Sans SC, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, Noto Sans SC, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.25
  title-sm:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 800
    lineHeight: 1.55
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "normal"
rounded:
  xs: "7px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  pill: "999px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "26px"
  gutter: "16px"
  gutter-wide: "32px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.green-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "42px"
  button-secondary-hover:
    backgroundColor: "{colors.fill}"
  button-soft:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.green-text}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "42px"
  button-small:
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "34px"
  button-cta:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.lg}"
    height: "56px"
    width: "100%"
  button-cta-hover:
    backgroundColor: "{colors.green-hover}"
  button-go:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.full}"
    size: "48px"
  button-icon:
    rounded: "{rounded.full}"
    size: "40px"
  input:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 14px"
    height: "46px"
  input-focus:
    backgroundColor: "{colors.surface}"
  input-paste:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "48px"
  chip:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green-ink}"
  tag-food:
    backgroundColor: "{colors.c-food-bg}"
    textColor: "{colors.c-food}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "0 8px"
    height: "22px"
  tag-ai:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.green-text}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "0 8px"
    height: "22px"
  tag-example:
    backgroundColor: "{colors.amber-tint}"
    textColor: "{colors.amber}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "0 8px"
    height: "22px"
  stage-saved:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.xs}"
    padding: "0 8px 0 7px"
    height: "22px"
  stage-want:
    backgroundColor: "{colors.c-shopping-bg}"
    textColor: "{colors.c-shopping}"
    rounded: "{rounded.xs}"
    padding: "0 8px 0 7px"
    height: "22px"
  stage-visited:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.green-text}"
    rounded: "{rounded.xs}"
    padding: "0 8px 0 7px"
    height: "22px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-place:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "12px"
  sheet:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.xl}"
  nav-tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    height: "64px"
  nav-tab-active:
    textColor: "{colors.green-text}"
  day-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  day-chip-selected:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.green-text}"
  timeline-photo:
    rounded: "{rounded.sm}"
    size: "58px"
  timeline-row-changed:
    backgroundColor: "{colors.amber-tint}"
    rounded: "{rounded.md}"
  pin-want:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: "56px"
  pin-saved:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: "42px"
  pin-visited:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: "34px"
  bubble-me:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.lg}"
    padding: "11px 14px"
  bubble-ai:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "11px 14px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
---

# Design System: 旅用

## Overview

**Creative North Star: "The Walkable Feed"**

旅用 looks like the place its content came from: a phone feed of photos. Saved posts land as photo cards on warm paper, and the same photos follow the place everywhere it goes after that: into the map as round photo pins, into the day as a photo timeline, into the place page as a full-bleed gallery. One forest green does every action and draws the route. Pastel category pills say what a place is without ever asking to be tapped. The system is friendly and plain, and it gets dense only where it is used on the move: the day timeline packs time, station number, photo, name, pills and the leg to the next stop into one compact row.

The world has five raises beyond the reference mockup, and each is a recorded rule below: the 收藏 → 想去 → 去过 stage scale (three dots, three stages), pins sized by priority, AI-changed rows that stay lit amber until someone taps 知道了, dense day rows, and numbered station order on both the timeline rail and the map. A city gets one recoloured basemap image, in a light and a dark version. Where there is no photo, a pastel category tile with the category icon stands in. There is never an empty grey box.

Two rejections are confirmed. The first is the empty-form dashboard: a screen with nothing in it yet shows a three-step how-to card and one green action, never a page of blank fields. The second is single-country imagery: defaults, placeholders and fallback art stay country-neutral or mix countries (the fallback hero is a generic dusk landscape with a road and a plane, not a landmark).

**Key Characteristics:**
- Warm paper ground, white rounded cards with soft ambient shadows, no card borders.
- Forest green is the only action colour, and it also draws the route, the station numbers and progress.
- Photo-led everything; every full-bleed photo carries its credit pill.
- Nine pastel category pairs label places, pills and photo placeholders.
- Heavy 800-weight headings in Figtree and Noto Sans SC; tabular figures for every aligned number.
- Phone-first with a thumb-height green AI action and a bottom tab bar, which becomes a 96px left rail from 1024px.
- Full light and dark themes driven entirely by custom properties.

## Colors

Warm paper neutrals, one forest green that acts, one amber that signals, and nine pastel category pairs that label but never act. Each colour key is the CSS custom property of the same name on `:root` (`green` is `--green`). The dark theme remaps every key under `prefers-color-scheme: dark` and `[data-theme="dark"]`, so components that use the properties follow automatically.

### Primary
- **Forest Green** (#1F5C45, `green`): every primary action. That covers the green buttons, the full-width AI action, the round paste "go" button, selected filter chips, my chat bubbles, the timeline rail dots and station numbers, the map route line, pin badges and the progress ring. In dark mode it lifts to a brighter jade (#3DA57A) with near-black ink on it.
- **Deep Forest** (#184C39, `green-hover`): hover and pressed state of anything filled green.
- **Green Ink** (#FFFFFF, `green-ink`): text and icons on a green fill.
- **Moss Wash** (#E6F0EA, `green-tint`): soft green surfaces, used for the AI suggestion box, "AI 推荐" pills, the selected day chip, soft green buttons, the reached 去过 stage, the active rail item on desktop and numbered how-to circles.
- **Leaf Text** (#1F6B4E, `green-text`): green words on paper or white. Links, the active tab label, "全部 N" section links and the 路线 handoff use it, because it holds contrast where the fill green would not be legible as text.

### Secondary
- **Lit Amber** (#A85F0C, `amber`) on **Lamp Glow** (#FFF3DD, `amber-tint`): the signal for "look at this". It marks AI-changed timeline rows and their note bar, the dot on a day chip with changes, pending inbox items, the 示例 example pill, warnings and soft error bubbles.
- **Heart Red** (#E5484D, `heart`): the filled heart of a 想去 place and the inbox count badge on the tab bar.
- **Alarm Red** (#C2352E, `danger`): destructive text buttons and their armed state, failed status and a negative balance in cost settling.

### Tertiary
- **Category pairs** (`c-<category>-bg` with `c-<category>`): a pastel background and a deep text of the same hue for food (apricot), cafe (latte), sight (leaf), shopping (rose), stay (harbour blue), experience (lilac), nightlife (indigo), transport (slate teal) and other (stone). One pair dresses the category pill, the tinted photo placeholder and the gradient art tile (140° from the pastel to a 22% mix of the deep hue). In dark mode each pair inverts to a deep tinted background with light text.

### Neutral
- **Warm Paper** (#F6F5F1, `bg`): the page ground, bottom sheets and the place-page body that overlaps its hero photo.
- **Card White** (#FFFFFF, `surface`): cards, the tab bar, secondary buttons, AI bubbles and map controls.
- **Linen Well** (#F0EFEA, `fill`): input wells, unselected chips, plain pills, hover fills, the empty progress track and empty ring.
- **Pressed Linen** (#E6E4DD, `fill-2`): scrollbars, grab handles, unreached stage dots and dashed drop-zone borders.
- **Pine Ink** (#1C1F1D, `ink`): primary text, the toast and the hotel base marker.
- **Slate Ink** (#434A46, `ink-2`): secondary text, field labels, times on the timeline and leg labels.
- **Lichen Grey** (#69706C, `muted`): meta lines, placeholders, inactive tab labels and counts.
- **Hairline** (#E7E5DF, `line`): row dividers inside cards, stat column rules, tab underlines and secondary button borders.
- **Shade** (rgb(20 24 22 / .46), `scrim`): the backdrop behind sheets.
- **Map Paper** (#F3F0E8, `map-land`) and **Map Grid** (#E7E3D8, `map-grid`): the map's ground. With no basemap they draw a synthetic 120px paper grid, which is labelled 示意图.

### Named Rules
**The Green Means Go Rule.** The green family is spent only on actions, the route, station order and progress. If something is green, it can be tapped or it shows how far along you are. Category pills never borrow `green`, and there is one full-width green action per screen.

**The Pills Label Rule.** Category pairs label: pills, placeholders, art tiles. They never fill a button, a selected state or a chart bar.

**The Lit Until Seen Rule.** Amber tint means something changed or needs a look, and it stays lit until a person acknowledges it (知道了). Amber is never decoration.

**The Token-Only Rule.** Component colour comes from the custom properties, so dark mode follows. Raw values are allowed only on photos and identities, where they are the same in both themes: white text, rims and scrims over photos, the brand mark, platform marks and drawn country flags.

## Typography

**Display Font:** Figtree for Latin letters and numerals, with Noto Sans SC for Chinese (then PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui)
**Body Font:** Figtree, with the platform's own Chinese sans (PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui)

**Character:** A rounded, open geometric Latin sans paired with a heavy, plain Chinese sans. Headings feel like feed captions set loud, not editorial headlines. Body text stays quiet in the system's native Chinese face so long notes and tips read easily on a phone.

### Hierarchy
- **Display** (800, 30px, 1.25, -0.01em): the hero question 下一站去哪儿？ in white over the trip photo, and the big money total on the costs tab.
- **Headline** (800, 26px, 1.25, -0.01em): page titles, place titles under their photo, guide titles over their photo, and the progress-ring percentage.
- **Title** (800, 19px, 1.25): section heads, sheet titles and trip-list card titles. Day titles, the trip header and the map title step up to 20px, the trip header to 24px from 760px, and the home trip card to 21px. Big stat numbers on the trip card are 22px.
- **Title-sm** (800, 15.5px, 1.55): the dense row name in timeline and pending rows, set in the body family; card titles and guide step titles sit at 16px.
- **Body** (400, 15px, 1.55): running text. Lead paragraphs open to 1.6, list lines run 14–14.5px, and meta lines run 12.5–13.5px in `muted`.
- **Label** (700, 12px): category pills, stage chips and status pills. Tab-bar labels are 12px at 600, field labels 13px at 700 in `ink-2`, and the credit pill 11px.

### Named Rules
**The Heavy Heading Rule.** Headings are 800, every time. Hierarchy comes from the size steps (30 / 26 / 20 / 19 / 16) and from paper-versus-white contrast, never from mixing weights or tinting headings.

**The Tabular Rule.** Any number that can sit above or beside another number uses tabular figures: times, stats, money, day chips, counts, step and pin numbers.

**The Display-Only CJK Face Rule.** Noto Sans SC is loaded at 700–900 only and belongs to the display role. Body Chinese is set in the platform's Chinese sans at regular weight.

**The Native Tracking Rule.** Large headings tighten to -0.01em. Positive tracking belongs only to the wordmark (.04em, .08em under the rail mark) and the map's area labels (.04em), where tracking is native to the material. There are no uppercase or tracked labels anywhere else.

## Layout

The layout is phone-first: a single column of white cards on paper, with 16px side gutters and a 1040px maximum page width. Cards stack 12–14px apart. A section opens 26px below the previous one with a heading row: a 19px title on the left and a green "全部 N" text link on the right. Spacing moves in 2px steps from 4px to 16px. The steps are 4 / 8 / 12 / 16, with 6, 10 and 14 used inside components. Card padding is 16px, and 12px for photo list cards.

The first viewport is a 330px full-bleed photo (plus the safe area). It carries the brand and a settings disc at the top, the white display question 68px down, and its credit pill near the foot. The paste card overlaps the photo's foot by 64px. The trip card follows with a four-column stat row. The full-width green AI action sits at thumb height above the fixed 64px tab bar, which adds the bottom safe area. Horizontal scrollers (recent places, photo strips) use 148px cards with 4:5 photos and scroll snapping, and they bleed to the screen edge.

Dense rows are a fixed grid. A timeline row is time (44px), rail (18px), photo (58px), content, then a 34px "more" button. The transit leg between two rows reuses the first two columns, so the rail runs unbroken down the day.

Breakpoints:
- **560px:** form grids go two columns.
- **720px:** bottom sheets become centred dialogs (620px, or 820px wide).
- **760px:** the library and trip lists go two columns.
- **1024px:** the tab bar becomes a 96px left rail with the brand mark, and gutters grow to 32px. Home splits into two columns (1.15fr / 1fr). Trip detail adds a 420px sticky side column. Map mode gets a 360px side list. Photo heroes become rounded 22px panels inside the page.

Safe-area insets are respected on every fixed edge.

## Elevation & Depth

Depth is a hybrid. Tonal layering does most of the work: paper ground, white card, linen well inside the card. Two soft, ambient shadows lift what sits above: cards rest, while sheets, the floating add button and the toast float. Green fills that ask to be pressed carry a faint green glow. Photo pins and controls over photos get a short dark shadow so they read against any image. Text on photos is made legible with forest-black gradient scrims and a soft text shadow, never with a box behind the text. Dark mode swaps the shadows for heavier black ones.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 2px rgb(28 31 29 / .04), 0 6px 18px rgb(28 31 29 / .06)`): every card, notice, review item, AI bubble and map control.
- **Float** (`box-shadow: 0 8px 28px rgb(28 31 29 / .14)`): sheets and dialogs, the floating add button and the toast.
- **Glass rest** (`box-shadow: 0 1px 2px rgb(28 31 29 / .07), 0 6px 16px -6px rgb(28 31 29 / .24)`, with an inset 1px top light, an inset lower-edge shade and a 0.5px outer hairline): every clear-glass control.
- **Tinted glass** (`box-shadow: 0 2px 4px rgb(20 50 36 / .14), 0 10px 22px -8px color-mix(in srgb, var(--green) 62%, transparent)`, same insets in white and black): every tinted-glass button. The floating add button deepens it to `0 16px 32px -10px` at 70%.
- **Over photo** (`box-shadow: 0 2px 10px rgb(0 0 0 / .22)`): milky glass discs on photos; the brand mark keeps `0 2px 8px rgb(0 0 0 / .18)`.
- **Pin** (`box-shadow: 0 3px 10px rgb(0 0 0 / .25)`): photo pins and the hotel base marker on the map.
- **Peek sheet** (`box-shadow: 0 -6px 24px rgb(0 0 0 / .1)`): the map's bottom peek sheet.

### Named Rules
**The Soft Lift Rule.** Cards rest on paper with the card shadow and no border. Only things that float above content (sheets, the add button, the toast) take the float shadow. Every shadow is blurred and ambient; there are no hard offset shadows.

**The Glass Controls Rule.** What you press is glass; what you read is solid. Buttons, chips, icon discs, the tab bar and stage circles are Liquid Glass; cards, sheets, bubbles, photos and text never are. Blur is spent only where something sits behind the control.

## Shapes

Everything is rounded, and the corners get larger as the element grows:
- **7px:** category and stage pills.
- **10px:** small thumbnails up to 64px and menu rows.
- **14px:** inputs, mini-card and place-card photos, notices, the AI box, day chips and stat wells.
- **18px:** cards, the AI action, chat bubbles and action cards.
- **22px:** sheet tops and desktop photo heroes.

Buttons, chips, the paste field, the search field, status pills and the toast are full pills. Icon buttons, avatars, rail dots, step numbers and photo pins are circles. The brand mark is a 30%-radius rounded square, and the hotel base marker is a small ink square with 8–9px corners and the character 住.

A photo pin is a circle with a 3px white rim and a small white triangular tail, like a dropped pin. Bubbles keep one 6px corner toward the speaker.

Lines are hairlines (1px) inside cards and on bars. Day chips and the drop zone use 1.5px, and the timeline rail and selected-tab underline use 2–2.5px.

**The Dashed Means In-Between Rule.** Solid lines are the fixed plan. Dashed lines are travel between stops (the leg segment of the rail, the route list's connectors), an AI-suggested stop (a dashed dot ring), or a drop target.

## Components

### Buttons
Liquid Glass (user brief, 2026-10-07). Every button is a piece of glass that presses in: a translucent fill, a gradient rim that catches light at the top-left and bottom-right (a 1px masked `::before` ring), an inner shade along the lower edge that gives the glass its thickness, and a soft drop shadow. Controls that float over photos, maps or scrolling content (the tab bar, the add button, map controls, chips over the map, discs on photos, the composer's buttons) also blur and saturate what is behind them (`backdrop-filter: blur(18px) saturate(180%)`; 28px under the tab bar). Buttons inside cards skip the blur, which would show nothing on a solid surface.
- **Shape:** full pill (999px), 42px tall; small 34px. Press scales to 0.96 with an exponential ease-out.
- **Clear glass (secondary):** 55% white over whatever is behind (8% white in dark mode), a 75% white sheen in the top half, ink text. Hover raises the fill to 80%.
- **Tinted glass (primary):** forest green at 88% (90% in dark mode) with a white sheen in the top half and a leaf-green caustic glow rising from the bottom edge, white text (dark ink in dark mode), and a green-tinted drop shadow. Used for the forward action: 加入行程, 收藏 N 个地点, the AI action, the round go and send buttons, the add button, selected filter chips and reached stage circles.
- **Soft:** moss-wash glass with leaf text and a green inner hairline, for secondary green actions and the selected day chip.
- **Ghost:** no fill, rim or shadow; hover fills linen.
- **Danger:** alarm-red text. The first tap arms it into red tinted glass, and the second confirms.
- **AI action:** full-width tinted-glass capsule, 56px, 17px at 700, with a sparkle icon, label and arrow. It is the one green action of the home screen.
- **Icon buttons:** 40px glass circles. Over photos they use milky glass (52% white, brightened blur) with a dark glyph in both themes, so they hold on any image. Plain header icons stay unfilled.
- **Fallbacks:** `prefers-reduced-transparency` swaps every glass fill for the solid surface or solid green and drops the blur; browsers without `backdrop-filter` get a near-opaque fill.
- **Focus:** every focusable element gets a 2.5px green outline at 2px offset. Disabled elements drop to 45% opacity and do not press.

### Chips
- **Filter chips:** 36px clear-glass pills with slate text at 14px/600 and an optional count at 70% opacity. When selected they turn to tinted green glass with white text. Over the map they blur the map behind them. Chip rows scroll sideways without a scrollbar.
- **Category pills:** 22px tall, 7px corners, 12px/700, one pastel pair per category. Related pills share the shape: plain (linen and slate), AI 推荐 (moss wash and leaf text), 示例 (amber), done (green fill).
- **Stage chip:** three 6px dots then the stage word. 收藏 shows one ink dot on linen, 想去 two rose dots on the rose wash, and 去过 three leaf dots on moss wash.

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** card white on warm paper. Sheets are paper, and cards sit inside them.
- **Shadow Strategy:** card rest; see Elevation & Depth.
- **Border:** none. Hairlines only divide rows inside a card.
- **Internal Padding:** 16px; 12px for photo list cards; 14px for notices and action cards.
- **Place card:** a 108 × 122px photo (14px corners) beside the category pill and stage chip, an 18px/800 name, the local name, the area line and a two-line note. A heart sits top-right. A place with more than one photo shows a small count chip (image icon + number) on the photo's lower right; the photos themselves live in the place page's gallery, never as extra tiles on the card. The foot row shows the source platform mark and companions' avatars.
- **Mini card:** 148px wide, a 4:5 photo frame (square in the map list) with a white heart disc, then the name and area. A place without a photo fills the same frame with its category tile.
- **Trip card:** the home version has a 40px drawn flag badge, a 21px title, dates, cities, avatars and four tabular stats divided by hairlines. The list version opens with a 150px three-photo collage.
- **Photo fallback:** a tinted tile with the category gradient and the category icon.
- **Credit pill:** 11px white text on 55% forest-black glass with a 6px blur, 10px corners. It sits on every full-bleed photo, at the photo's lower edge, and wraps to a second line rather than cutting off the source.

### Inputs / Fields
- **Style:** a linen well with no visible border, 14px corners, 46px tall and 16px text, so phones do not zoom.
- **Focus:** the border turns forest green and the well turns white. The caret is green everywhere.
- **Paste and search:** pill variants 48px tall. The paste field pairs with a 48px green circle "go" button carrying the green glow.
- **Labels and hints:** labels 13px/700 in slate; hints 13px in lichen grey.
- **Money:** amounts are typed at 28px/800 with tabular figures.
- **Drop zone:** a 1.5px dashed border; on drag-over it turns moss wash with a green border.

### Navigation
- **Phone:** a floating Liquid Glass capsule, 64px tall and 32px round, 12px from the screen sides and 10px above the safe area, frosted over the content scrolling under it. It has four tabs, 首页 · 收藏 · 行程 · AI 助手, each a 24px stroke icon over a 12px/600 label. A moss-wash glass lens sits behind the current tab and slides to the next one (0.55s, exponential ease-out; instant with reduced motion); the current tab turns leaf green, and a red count badge marks pending inbox items.
- **Desktop (1024px and up):** the same glass as a floating 84px rail, 12px from the window edges, with the brand mark and wordmark on top. The current tab sits in an 18px-corner moss-wash glass lens.
- **Trip tabs:** 15px/700 text tabs (概览 · 行程 · 地图 · 花费 · 待安排) over a hairline. The selected tab is leaf green with a 2.5px green underline.
- **Day chips:** at least 78px wide, clear glass with 14px corners. Each shows "Day N" over a tabular date. When selected the chip turns to moss-wash glass with a green inner hairline and leaf text. An amber dot flags a day with AI changes.

### Day Timeline (signature)
The walkable day is a vertical transit line of photo stops.
- **Row:** a right-aligned tabular time (13px/700), the rail, a 58px photo with 10px corners, then the name (15.5px/800) with its category pill and any AI 推荐 pill, a two-line meta, and a "more" button. A companion's avatar can sit on the photo's corner.
- **Rail:** a 2px line mixing green into the hairline. Each stop has an 18px dot with a 2.5px green ring and its station number. The hotel start dot is solid green. A visited stop is solid green with a check, and an AI-suggested stop has a dashed ring.
- **Leg:** between two stops, the rail turns dashed. A 12.5px line gives the mode icon, the bold mode and minutes, then detail and fare, and ends in a leaf-green 路线 pill on `green-tint` inside a 44px tap target that hands off to a map app.
- **City change:** a transfer row uses a slate-teal transport tile with the mode icon and a 换城市 pill.
- **AI changed:** touched rows fill with lamp glow, 14px corners, bleeding 8px past the row. The day shows an amber note bar ("AI 改了这一天的 N 处") with a 知道了 button, and they stay lit until it is tapped.

### Photo Pins and City Basemap (signature)
- **Pin size by priority:** 想去 56px, 收藏 42px, 去过 34px. A visited pin is desaturated to 55% and carries a green check, and higher priority draws on top. Clusters are 52px with a green count badge. A selected pin scales to 1.14 and its rim turns green. Day maps add a green station-number badge.
- **Route:** a 7px white underlay with a 3.5px forest-green line through the day's stops in order.
- **Hotel:** a 30px pine-ink square with 住 in paper colour.
- **Basemap:** one recoloured image per city, with a dark version picked by the colour scheme, rendered with wide margins around the saved places. The full-screen 地图模式 opens with the basemap covering the whole view (no paper around it); 显示全部地点 may zoom out past that. Smaller in-page maps feather their edges into map paper with a 5% mask. Area labels are 13px/800 slate with a paper halo.

### Stage Control (signature)
On a place page, 收藏 → 想去 → 去过 is a three-step control on a white card. It has three 34px circles joined by a 2px line. Reached steps and their joining line fill forest green, and the current step adds a 4px moss-wash halo. Tapping the heart to mark a place 想去 plays a short "pluck": a scale to 1.25 with a -6° turn over 0.6s on the settle curve. The pluck is skipped under reduced motion.

### AI Assistant
- **Header:** a 46px green bot disc.
- **Bubbles:** mine are forest green with white text; the AI's are white with the card shadow. Both have 18px corners, with a 6px corner toward the speaker.
- **Quick actions:** three-column outline pills.
- **Changes:** proposed changes arrive as white action cards with a moss-wash icon tile. Places the AI mentions appear as 16:9 photo cards with a bottom scrim.
- **Composer:** a frosted paper bar (92% paper, 10px blur) above the tab bar, with a pill field and the green go button.

### Sheets and Toast
- **Sheets:** bottom sheets on paper with 22px top corners, a grab handle and the float shadow. They rise in over 0.32s on the settle curve, and from 720px they become centred dialogs.
- **Toast:** an ink pill with paper text, floating above the tab bar.

### Brand Mark
A 30%-radius square in forest green (#1F5C45), which stays that colour in both themes. Inside, a white route line runs from a light-green start dot to a white end dot, the same route that the 行程 tab icon draws. The wordmark 旅用 is 800 weight, tracked .04em, and turns white with a soft shadow over photos.

## Do's and Don'ts

### Do:
- **Do** take every colour from the custom properties (`var(--green)`, `var(--c-food-bg)` and so on) so dark mode follows. Keep raw values for things on photos and for identities.
- **Do** lead every place surface with its photo. Without one, show the category art tile (pastel gradient plus category icon).
- **Do** put the credit pill on every full-bleed photo.
- **Do** spend forest green (#1F5C45) on actions, the route, station numbers and progress, with one full-width green action per screen at thumb height.
- **Do** keep the stage order 收藏 → 想去 → 去过 wherever status appears, and size map pins by priority (56 / 42 / 34px).
- **Do** keep AI-touched rows lit in lamp glow until someone taps 知道了, and mark AI additions with the AI 推荐 pill and a dashed rail dot.
- **Do** number stops in station order on both the timeline rail and the map pins.
- **Do** end every travel leg with a 路线 handoff link (44px tap target).
- **Do** set aligned numbers in tabular figures and headings at 800.
- **Do** draw icons as 24px stroke SVGs (1.8 stroke, round caps and joins, `currentColor`).
- **Do** keep defaults, placeholders, examples and fallback art country-neutral or mixed across countries.

### Don't:
- **Don't** build empty-form dashboards. An empty screen gets the three-step how-to card and one green action.
- **Don't** fill a button, a selected state or a chart bar with a category colour, or use amber as decoration.
- **Don't** put Noto Sans SC in a body or label font stack. It is loaded at 700–900 only, so body Chinese falls onto the bold face on devices without PingFang SC or Hiragino Sans GB.
- **Don't** add borders around cards or hard offset shadows. Depth is paper, white card, soft shadow.
- **Don't** use emoji or symbol characters as icons. Drawn SVG flags replace emoji flags, which render as letters on Windows.
- **Don't** put small uppercase or tracked labels above titles. A title leads its block, and meta follows below it.
- **Don't** use a single country's landmark, symbol, flag or city as a default image, category icon, placeholder or example.
