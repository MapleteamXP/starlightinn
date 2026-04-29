# Starlight Inn v3.5 — Remaining Agents Plan

## Status
- 4 of 6 agents completed successfully in previous wave
- PathfindingWorld_Dev: FAILED to dispatch (JSON parse error) — needs re-dispatch
- SeasonsAI_Dev: Never dispatched — needs dispatch

## Agent 5: PathfindingWorld_Dev
**Files to create:**
1. `js/world/GridPathfinding.js` — A* pathfinding with 8-directional movement, Manhattan heuristic, path smoothing, tap-to-move interface, grid serialization
2. `js/world/CollisionSystem.js` — Entity-entity and entity-world collision, portal triggers, social zone detection, wall sliding response, spatial hash for O(1) lookups

## Agent 6: SeasonsAI_Dev
**Files to create:**
1. `js/world/SeasonalContent.js` — Seasonal limited-time sets (Christmas, Halloween, Easter, Tribal), seasonal area decorations, timed availability, exclusive currency items
2. `js/safety/AIModeration.js` — AI-assisted chat moderation with contextual analysis, sentiment scoring, toxicity detection, confidence thresholds, false-positive appeal
3. `js/engine/DebugConsole.js` — In-game debug overlay: network latency graph, collision error counter, asset cache stats, FPS/memory graphs, 12 toggleable debug categories

## Integration Stage (after both agents complete)
1. Wire all new modules into `main.js`
2. Update `index.html` to load new modules
3. Create final ZIP package
4. Update README with v3.5 features

## Dispatch Strategy
Both agents are independent — dispatch in parallel.
