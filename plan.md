# Plan: KawaiiCool Island - Unity Cross-Platform Social World Game

## Overview
Build an original Unity 2023.2+ LTS project with URP for a mobile+desktop cross-platform social world game. Kawaii-cool aesthetic, avatar customization, realtime multiplayer, island editor, minigames, inventory/shop, chat, and audio systems.

## Stage 1 — Deep Research
**Skill**: `deep-research-swarm`
**Agents**: Multiple research agents in parallel
- Research Agent A: Unity URP 2023.2+ best practices, cross-platform mobile/desktop optimization, SpriteRenderer layering for avatars, 2D animation rigging
- Research Agent B: Unity Netcode for GameObjects vs Mirror comparison, room-based multiplayer architecture, player proximity chat, movement interpolation
- Research Agent C: Firebase/PlayFab integration patterns, secure economy server validation, REST API design for game backends, cloud save architecture
- Research Agent D: UI/UX patterns for responsive Canvas Scaler, mobile vs desktop input handling, drag-drop inventory systems in Unity

**Output**: Validated research brief with code patterns, architecture decisions, and library recommendations.

## Stage 2 — Project Architecture & Core Framework
**Skill**: `vibecoding-general-swarm` + `full-stack-developer` (for backend)
**Agents**: Architecture team
- Core Architect: Project folder structure, Assembly Definition files, ScriptableObject architecture, base singletons, event bus system, save/load framework
- URP Setup Specialist: URP pipeline asset, 2D renderer settings, post-processing (bloom), quality tiers for mobile/desktop

**Output**: Complete Unity project foundation with core framework code.

## Stage 3 — Parallel System Implementation
**Skill**: `vibecoding-general-swarm`
**Agents** (parallel, independent with clear interfaces):
- Agent 1: Avatar System — Modular avatar controller, SpriteRenderer layering, Animator setup, ScriptableObject clothing/accessory/hair/makeup definitions, emote system
- Agent 2: Island Editor — Grid/free placement, Tilemap integration, snap-to-grid, rotation/scaling, save slots with JSON serialization
- Agent 3: Multiplayer Foundation — Netcode/Mirror room manager, player spawn, proximity detection, movement interpolation, network transform
- Agent 4: UI Framework — Responsive Canvas Scaler presets, screen resolution handling, smooth transitions (DOTween-style coroutines), particle integration, input abstraction layer (touch/keyboard/gamepad)
- Agent 5: Chat System — TMP chat bubbles, emote reactions, typing indicators, message filtering, chat channels (world/proximity/island)
- Agent 6: Minigame Framework — State machine base, coroutine-based game loops, rhythm dance prototype, fashion voting, coin rush, trivia, hide-seek stubs
- Agent 7: Inventory & Shop — Grid UI with drag-drop, rarity tiers (ScriptableObjects), currency types, daily rewards, event system, shop UI
- Agent 8: Audio System — Dynamic music layer mixing, spatial audio 2D setup, SFX event system, voice chat integration stub
- Agent 9: Backend Integration — Firebase Auth, PlayFab economy, REST API client, server validation stubs, analytics events, leaderboard integration

**Output**: Complete C# scripts for each system, prefab stubs, and ScriptableObject assets.

## Stage 4 — Integration & Assembly
**Agents**: Integration team
- System Integrator: Wire all systems together via event bus, ensure cross-system communication (avatar changes reflect in UI, inventory updates trigger VFX, etc.)
- Build Configurator: Cross-platform build settings, Android/iOS/Windows/macOS configurations, input system settings, performance LODs

## Stage 5 — Documentation & Delivery
**Agent**: Documentation writer
- README with setup instructions
- Architecture diagram (text-based)
- API documentation for key systems
- Build guide for all platforms

## Key Technical Decisions
- Unity 2023.2+ LTS with 2D URP
- Input System (new) with touch/keyboard/gamepad support
- Netcode for GameObjects (Unity official) or Mirror (community proven) — TBD after research
- TextMeshPro for all text
- JSON-based save system (locally) + Firebase/PlayFab cloud sync
- ScriptableObject-driven data architecture
- Event-driven communication between systems
- DOTween or custom tweening for UI animations

## File Structure Target
```
Assets/
  _Project/
    Scripts/
      Core/ (singletons, event bus, save system)
      Avatar/ (avatar controller, equipment, emotes)
      Island/ (editor, placement, save/load)
      Multiplayer/ (netcode, rooms, sync)
      UI/ (canvas management, transitions, responsive)
      Chat/ (chat manager, bubbles, moderation)
      Minigames/ (state machine, game modes)
      Inventory/ (grid, drag-drop, shop)
      Audio/ (music layers, SFX, spatial)
      Backend/ (Firebase, PlayFab, REST client)
    ScriptableObjects/
    Prefabs/
    Scenes/
    Settings/ (URP assets, input actions)
```
