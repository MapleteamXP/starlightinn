# KawaiiCool Island v3.0 — Master Design Document
## Professional Social Virtual World — Production-Ready Specification

---

## 1. Product Goals

### Primary Objective
Transform KawaiiCool Island into a premium, scalable, highly social, smooth, and addictive virtual world experience that rivals classic social worlds like Habbo and BoomBang while being original and modern.

### Success Criteria
- New users can create an avatar and enter a room in under 60 seconds
- Players can discover and interact with others without friction
- Social features feel central, not bolted-on
- Every system has safeguards for safety and fairness
- Performance stays at 60fps on mid-tier mobile devices
- The game feels "alive" with constant activity and discovery

---

## 2. Feature Requirements

### 2.1 Avatar System (Refined v3.0)
**Status**: v2.0 implemented. v3.0 refinements:
- Mobile-first touch targets (min 64x64dp)
- Instant outfit swap without lag (async loading with placeholder)
- Pose switching in preview (idle, walk, wave, dance)
- Outfit collections (group outfits by theme)
- Recently worn history (last 10 outfits)

### 2.2 Zoom & Camera (Refined v3.0)
**Status**: v2.0 implemented. v3.0 refinements:
- Habbo-style discrete zoom levels (close/medium/far) vs continuous
- UI zoom buttons always visible (accessibility)
- Auto-recenter on double-tap/double-click
- Room focus mode (camera locks to room center)
- Performance: cull off-screen objects during zoom

### 2.3 Social Interaction (Refined v3.0)
**Status**: v2.0 implemented. v3.0 refinements:
- "Nearby Users" panel showing people in current room
- "People You May Know" based on mutual friends
- Mutual friend display on profile
- Inspect outfit (view all equipped items with names)
- Recent interactions history

### 2.4 World & Rooms (Refined v3.0)
**Status**: v2.0 implemented. v3.0 refinements:
- Room owner dashboard (settings, moderation, analytics)
- Room entry/exit fade transitions
- Room capacity scaling (hide players if >50, show "+32 more")
- Quick-join from any social panel
- Room ratings (thumbs up/down)

### 2.5 Trading System (NEW v3.0)
**Status**: NOT IMPLEMENTED. Required by master prompt.
- Player-to-player trading with safeguards
- Trade window with drag-drop items
- Trade confirmation with both-party accept
- Trade history and receipts
- Anti-scam safeguards (trade value indicator, confirmation timer)
- Trade restrictions (level requirement, friend-only option)

### 2.6 Room Moderation & Settings (NEW v3.0)
**Status**: NOT IMPLEMENTED. Required by master prompt.
- Room owner settings (name, description, privacy, capacity)
- Moderation permissions (kick, mute, ban from room)
- Co-host assignment
- Room rules display
- Event hosting tools (event setup, promotion)
- Room analytics (visits, favorites, peak concurrent)

### 2.7 Safety & Moderation (NEW v3.0)
**Status**: Partial (basic report/block). Required by master prompt.
- Rate limiting on all social actions (friend requests, messages, trades)
- Spam detection (repeated identical messages, rapid messaging)
- Account protection (suspicious login detection)
- Moderation dashboard for room owners
- Escalation workflow (report → review → action)
- Safety controls visible everywhere (report button on every profile)
- Child-safety features (under-13 mode, restricted chat)

### 2.8 Social Missions & Retention (NEW v3.0)
**Status**: NOT IMPLEMENTED. Required by master prompt.
- Daily social missions ("Wave to 3 people", "Join a party", "Visit a friend's room")
- Weekly mission tracks
- Mission rewards (coins, exclusive items, XP)
- Streak bonus for completing all daily missions
- Social leaderboards (most helpful, most visited room, etc.)

### 2.9 Onboarding Flow (NEW v3.0)
**Status**: NOT IMPLEMENTED. Required by master prompt.
- First-time user tutorial (character creation → enter world → interact → friend)
- Interactive guided tour with highlights
- Tooltip system for first encounters with features
- Progress tracking with rewards for completing onboarding
- Skip option for experienced users

### 2.10 Performance & Technical (NEW v3.0)
**Status**: Partial. Required by master prompt.
- Object culling based on camera view
- Sprite LOD system (lower res sprites at distance)
- Texture streaming for avatar parts
- Dynamic quality adjustment based on FPS
- Pool management for particles and UI elements
- Memory budget tracking and warnings

---

## 3. UI/UX Design Principles

### 3.1 Quality Bar
- **Fast**: Every interaction responds within 100ms
- **Clean**: No visual clutter, clear hierarchy, generous whitespace
- **Premium**: Polished animations, consistent iconography, modern typography
- **Playful but not messy**: Kawaii aesthetic with professional restraint
- **Easy for new users**: Obvious next actions, progressive disclosure
- **Deep for long-term players**: Advanced features accessible through exploration

### 3.2 Mobile-First
- Touch targets minimum 64x64dp
- Thumb-friendly zones (actions at bottom, navigation at sides)
- Gesture support (swipe, pinch, long-press)
- Bottom sheet pattern for menus
- Floating action button for primary action

### 3.3 Desktop Excellence
- Keyboard shortcuts for all common actions
- Hover states and tooltips
- Right-click context menus
- Window management (movable panels, snap-to-edge)

---

## 4. Gameplay Systems

### 4.1 Core Loop
1. Enter world → 2. Discover activity/people → 3. Interact socially → 4. Earn rewards → 5. Customize/Progress → 6. Return tomorrow

### 4.2 Retention Mechanics
- Daily login bonus (escalating streak)
- Daily social missions (3-5 per day)
- Weekly event rotation
- Seasonal content (limited-time items, rooms, themes)
- Friendship progression (relationship levels)
- Collection completion (badges, items, room decorations)

### 4.3 Monetization (Cosmetic-Only)
- Premium currency (Gems) for exclusive items
- Battle pass / Season pass (cosmetic rewards)
- Room expansion slots
- Extra outfit preset slots
- NO pay-to-win: all gameplay advantages earned through play

---

## 5. Social Systems

### 5.1 Discovery Flow
1. Enter room → see nearby users list
2. Tap someone → see interaction menu
3. View profile → add friend or start chat
4. Friend accepts → see them in friend list
5. See friend's activity → visit their room
6. Join party/gathering → meet more people

### 5.2 Presence & Activity
- Real-time online status with location
- Activity indicators ("In Minigame", "Editing Island", "At Event")
- Last seen for offline friends
- Mutual friends count on profiles
- "Friends in this room" indicator

### 5.3 Communication
- Room chat (public to all in room)
- Proximity chat (nearby only)
- Private messages (cross-room)
- Party chat (party members)
- Whisper (ephemeral, no history)
- Emote reactions on messages

---

## 6. Technical Architecture

### 6.1 Data Flow
```
Client → Input → Game Logic → Network Sync → Server Validation → State Update → UI Refresh
```

### 6.2 Network Model
- Owner-authoritative for position and avatar
- Server-authoritative for economy and inventory
- Optimistic UI for social actions (friend requests, messages)
- Eventual consistency for presence and activity feed

### 6.3 State Management
- Local state: UI, camera, input
- Shared state: Player positions, room state
- Server state: Inventory, currency, friends, profiles
- Cached state: Room listings, shop items, event calendar

### 6.4 Performance Budgets
- Mobile: <100 draw calls, <50 SetPass, <128MB texture memory
- Desktop: <200 draw calls, <100 SetPass, <512MB texture memory
- Target: 60fps mobile, 144fps desktop

---

## 7. Safety & Moderation

### 7.1 Player Safety
- Report button on every profile and chat message
- Block prevents all interaction (chat, trade, friend, room visit)
- Mute prevents chat only
- Account protection (email verification, 2FA option)
- Under-13 mode (restricted chat, no trading, no whispers)

### 7.2 Content Safety
- Profanity filter on all text input (names, chat, bios, room names)
- Image moderation on uploaded avatars/thumbnails
- Room name/description filtering
- Trade item name filtering

### 7.3 Anti-Abuse
- Rate limits: 1 friend request/minute, 5 messages/10 seconds, 1 trade/minute
- Spam detection: 3 identical messages in 30 seconds = mute warning
- Bot detection: movement pattern analysis, CAPTCHA on suspicious actions
- Alternate account detection: device fingerprinting

### 7.4 Moderation Tools
- Room owner: kick, mute, ban from room (temporary or permanent)
- Global moderators: account suspension, chat ban, trade ban
- Automated: filter violations → warning → temporary mute → escalation
- Appeals system for contested bans

---

## 8. Implementation Roadmap

### Phase 1: Core Social (v2.0 Complete)
- [x] Avatar customization
- [x] Room browser
- [x] Friend system
- [x] Chat system
- [x] Party system
- [x] Activity feed

### Phase 2: Professionalization (v3.0 Current)
- [ ] Trading system with safeguards
- [ ] Room moderation & settings
- [ ] Enhanced safety/anti-abuse
- [ ] Social missions
- [ ] Onboarding flow
- [ ] Performance optimization

### Phase 3: Scale (Future)
- [ ] Clan/guild system
- [ ] Seasonal events framework
- [ ] Battle pass
- [ ] UGC (user-generated content)
- [ ] Mobile push notifications
- [ ] Advanced anti-cheat

---

## 9. Priority Fixes (v3.0)

1. **Trading System** — Highest priority. Master prompt explicitly requires this.
2. **Safety/Moderation** — Critical for launch readiness. Rate limiting, spam detection.
3. **Room Settings** — Room owners need control over their spaces.
4. **Onboarding** — Directly impacts new user retention.
5. **Social Missions** — Drives daily engagement.
6. **Performance** — Must hit 60fps consistently.

---

## 10. Risks & Edge Cases

### 10.1 Risks
- **Scope creep**: Social worlds are complex; must maintain focus on core loop
- **Performance**: Too many players in one room could degrade experience
- **Safety**: Social games attract bad actors; moderation must be robust
- **Backend costs**: Real-time multiplayer and presence are expensive at scale

### 10.2 Edge Cases
- Player trades item then disconnects before confirmation
- Room owner leaves while guests are present
- Friend request sent to player who just blocked sender
- Zooming out when room is larger than camera bounds
- Player spams emotes to create visual clutter
- Two players trade the same item simultaneously
- Moderator action conflicts with automated system action

---

## 11. Final Quality Checklist

Before any feature is considered complete:
- [ ] Works on mobile (touch) and desktop (mouse/keyboard)
- [ ] Has error handling for all async operations
- [ ] Respects rate limits and doesn't spam backend
- [ ] Accessible (sufficient contrast, readable text, supports screen readers where possible)
- [ ] Safe (no exploits, no bypass of moderation)
- [ ] Fast (<100ms response for UI, <2s for network operations)
- [ ] Tested (happy path, error path, edge cases)
