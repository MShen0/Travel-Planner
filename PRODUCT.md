# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner and their travel companions. They live in Malaysia (home currency RM) and read Simplified Chinese with
everyday English mixed in. They find places and how-to guides while scrolling 小红书, Instagram Reels, TikTok and
抖音 on their phones, save them, and later turn the saved places into a trip together. The companions open the same
page (shared from claude.ai), add places and edit the plan.

## Product Purpose

旅用 turns places found on social media into trips actually taken, in any country: paste a post or
screenshots and the places are saved with what to eat and what to watch out for; pick cities and days and get a
day-by-day route with transport for every leg; follow how-to guides step by step; keep track of what the trip costs
in RM. Success is a trip the group can follow from their phones without re-researching anything.

## Positioning

The planner works from the places the group already saved from social posts, not from generic top-10 lists, and it
runs on the users' own Claude plan with free map and geocoding services: no API keys, no subscription.

## Operating Context

- Mostly used on phones inside the Claude app or a mobile browser; sometimes on a laptop while planning.
- Two halves share one database: the claude.ai artifact (`app/bacao.html`, Claude via the `sample` capability) and the
  Claude Code agent (`/collect`, `/guide`, `/plan-trip`) that can open links, read post images, watch videos and
  geocode.
- Trips go anywhere (Korea, Taiwan, Thailand, Japan, Europe, China…) and are either one city or several cities in one
  trip (e.g. 首尔 → 釜山 with a KTX day). Nothing in the interface may assume one country: the default imagery, examples
  and placeholders stay country-neutral or mix countries.
- Navigation and live transit are handed off to Google Maps, Apple Maps, 高德 or Naver.

## Capabilities and Constraints

- Artifact sandbox: no external network, images, tiles or fetches from the page; external scripts only from the
  allowed CDNs; fonts only from Google Fonts. Photos come from uploaded screenshots or agent-uploaded assets; a real
  map background must be a static image the agent uploads.
- Data lives in the artifact `db` (`places`, `trips`, `guides`, `inbox`, plus new collections as needed); the schema in
  `CLAUDE.md` is shared with the agent and must stay compatible.
- Shared use: anyone the owner shares the page with as a Contributor or Editor can add and edit. Each viewer's AI calls
  use that viewer's own Claude plan.
- Spending: local prices are shown with an RM conversion; exchange rates must come from data the agent or the user
  provides (the page cannot fetch them).
- Free to run is a hard constraint: no paid APIs.

## Brand Commitments

- Name 旅用 (renamed from 拔草计划 in 2026-10 at the user's request). Plain words, no 种草 / 拔草 slang (user request
  2026-10-07): a place moves 收藏 → 想去 → 去过, and the home question is 下一站去哪儿？.
- Binding visual reference from the user (2026-10): a warm off-white phone app with deep forest-green accents, white
  rounded cards, photo-led place cards, pastel category tags, a home screen with a photo hero, a 收藏 list, a map mode
  with photo pins, trip days with photo timelines, an AI 旅行助手 chat, place detail pages and a progress ring.
  Bottom navigation: 首页 · 收藏 · 行程 · AI 助手.
- Buttons are Liquid Glass (user request 2026-10-07): clear glass for everyday controls, forest-green tinted glass for
  the forward action, and a floating glass tab bar.

## Evidence on Hand

- Example data in the live app (marked as examples, removable in 设置): 21 places in 首尔, 釜山, 曼谷 and 巴黎 with
  Wikimedia Commons photos, a 5-day 首尔 → 釜山 trip with expenses and an airport-to-hotel guide.
- The owner's own data: 17 places in 台北, 新北, 台中 and 基隆 from a public Instagram Reel (a 5-day Taiwan itinerary),
  with cover frames cut from the video.
- No ratings, review counts or hotel prices from Google or booking sites are available; never show invented ratings or
  prices. Social proof that does exist: the source post's like and save counts.

## Product Principles

1. Saved posts are the source of truth; anything the AI adds is labelled as a suggestion or an estimate.
2. Every leg of a plan ends in a one-tap handoff to a real map app for live transit.
3. Phone first, in the situation it is used: scrolling a feed, standing on a platform, splitting costs at dinner.
4. Shared by default: a companion can add, edit and follow without setup beyond the claude.ai share.
5. Free to run, always.
