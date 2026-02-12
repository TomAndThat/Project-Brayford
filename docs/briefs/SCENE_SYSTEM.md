# Scene System Architecture

**Domain:** Interaction Domain  
**Status:** Approved - Implementation Pending  
**Last Updated:** 12 February 2026

---

## Problem Statement

Event organisers need the ability to control what content appears on audience devices during live events, and when it's displayed. Content includes interactive modules (Q&A, polls, voting), static screens (welcome messages, sponsor content), and other engagement widgets.

**Requirements:**

- Pre-plan content flow during event setup
- Create new scenes or edit existing scenes during live events
- Switch between scenes (content views) in real-time
- All 5,000+ concurrent audience members see changes instantly
- Reuse common scene templates across events
- Control module visibility and stack order

---

## Architecture Decision: Event Scenes

We've chosen a **scene-based approach** (similar to slides in a presentation or scenes in OBS Studio) over individual module toggling or complex layout systems.

### Why Scenes?

1. **Natural mental model**: Event flows have a narrative structure (welcome → Q&A → poll → results → thank you)
2. **Pre-planning friendly**: Most organisers prepare content ahead of time as part of pre-production
3. **Template-friendly**: Common scene patterns can be saved and reused
4. **Still flexible**: Scenes aren't locked once the event starts - organisers can edit scenes on the fly
5. **Simple real-time sync**: One field change broadcasts new state to all devices
6. **Room to grow**: Architecture supports adding live overrides later if needed

---

## Data Model

### Core Entities

#### Scene Document

```typescript
// Collection: /scenes/{sceneId}
{
  id: SceneId                    // Unique identifier
  eventId: EventId               // Parent event (null for templates)
  organizationId: OrganizationId // For templates, determine ownership
  name: string                   // "Welcome Screen", "Open Q&A", "Poll #1"
  description?: string           // Optional notes for the creator
  modules: ModuleInstance[]      // Ordered array of modules in this scene
  isTemplate: boolean            // Can be reused across events
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: UserId              // User who created this scene
}
```

#### Module Instance (Embedded in Scene)

```typescript
// Not a separate collection - embedded in scene.modules array
{
  id: string                     // Unique within scene (UUID)
  moduleType: ModuleType         // "welcome" | "qna" | "poll" | "countdown" | "sponsor"
  order: number                  // Stack order (0 = bottom, higher = top)
  config: Record<string, any>    // Module-specific configuration
}

// Example module configs:
// Welcome module
config: {
  title: "Welcome to the Show!",
  message: "We're glad you're here. Questions coming soon.",
  backgroundColor: "#1a1a1a"
}

// Q&A module
config: {
  sessionId: QASessionId,  // Links to separate Q&A session
  displayMode: "submit" | "viewing" | "closed"
}

// Poll module
config: {
  pollId: PollId,         // Links to separate poll
  question: "What topic should we cover next?",
  options: ["AI", "Web3", "Climate"],
  allowMultiple: false
}
```

#### Event Live State (Subcollection)

```typescript
// Document: /events/{eventId}/live/state
{
  activeSceneId: SceneId | null; // Currently displayed scene (null = no active scene)
  sceneUpdatedAt: Timestamp; // Changed when active scene's content is edited
  updatedAt: Timestamp; // Changed on any update

  // Future expansion without breaking changes:
  // liveParticipantCount?: number
  // currentPollId?: PollId
  // moderationMode?: "open" | "filtered" | "closed"
}
```

#### Event Document Updates

```typescript
// Add to existing Event schema
{
  ...existing fields,

  // Scene history for analytics/debugging
  sceneHistory?: Array<{
    sceneId: SceneId,
    switchedAt: Timestamp,
    switchedBy: UserId
  }>
}
```

---

## Real-Time Sync Strategy

### Audience Device Listener Pattern

**Chosen approach:** Lightweight live state subscription + on-demand scene fetching

```typescript
// Audience app subscribes to ultra-light live state document
const unsubscribe = onSnapshot(
  doc(firestore, "events", eventId, "live", "state"),
  (snapshot) => {
    const liveState = snapshot.data();

    // When scene changes, fetch the new scene
    if (liveState.activeSceneId !== currentSceneId) {
      loadAndRenderScene(liveState.activeSceneId);
    }

    // When current scene content is edited during live event
    if (liveState.sceneUpdatedAt > lastSceneUpdate) {
      reloadAndRenderScene(liveState.activeSceneId);
    }
  },
);
```

### Why Not Listen to Scene Documents Directly?

**Alternative considered:** `onSnapshot(doc('scenes', activeSceneId))`

**Rejected because:**

1. Requires dynamically changing listeners when scenes switch (more complex)
2. Users might edit scenes that _aren't_ active (would trigger unnecessary reads)
3. Less clear separation between "what's showing" vs "what's available"

**Cost difference:** Negligible (pennies per event either way)

---

## Firestore Cost Analysis

### Real-Time Listeners at Scale

**Scenario:** 5,000 concurrent participants, 2-hour event

| Action                      | Reads       | Cost       |
| --------------------------- | ----------- | ---------- |
| Initial listener connection | 5,000       | $0.002     |
| 20 scene switches           | 100,000     | $0.036     |
| 5 mid-event scene edits     | 25,000      | $0.009     |
| **Total per event**         | **130,000** | **$0.047** |

**Monthly cost at 100 events/month:** ~$4.70

### Why Not Polling?

**Same scenario with 5-second polling:**

- 2 hours = 7,200 seconds
- 7,200 / 5 = 1,440 polls per user
- 1,440 × 5,000 = 7.2M reads per event
- **Cost**: $2.59 per event (65× more expensive)

**Verdict:** Real-time listeners are the clear winner for this use case.

---

## Scene Lifecycle

### 1. Setup Phase (Before Event Goes Live)

```
Creator Dashboard:
1. Navigate to event settings
2. Access "Scenes" tab
3. Create scenes:
   - Add modules from library (drag & drop or list)
   - Configure each module
   - Reorder modules
   - Preview on simulated audience device
4. Mark scenes as templates (optional) for reuse
5. Set default/starting scene
```

### 2. Live Phase (During Event)

```
Creator Live Controls:
1. View scene list with thumbnails/descriptions
2. Click "Switch to Scene" → Updates activeSceneId
3. All audience devices receive update within ~100-300ms
4. Optional: Edit an existing scene while live
   - Changes saved to Firestore
   - sceneUpdatedAt timestamp updates
   - Audience devices detect change and re-render
```

### 3. Template Reuse

```
Creating Event from Template:
1. Select "Use template scenes"
2. System copies scene documents (eventId updated to new event)
3. Creator can customize copies without affecting original
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (MVP)

- [ ] Scene schema and Firestore collections
- [ ] Event live state subcollection
- [ ] Basic scene CRUD operations (create, read, update, delete)
- [ ] API routes for scene management
- [ ] Update event schema with scene history

### Phase 2: Module System Foundation

- [ ] Module type registry
- [ ] Three starter modules:
  - Welcome screen (static content)
  - Q&A integration (links to future Q&A module)
  - Poll integration (links to future poll module)
- [ ] Module config validation schemas (Zod)

### Phase 3: Creator UI

- [ ] Scene builder interface (drag-and-drop)
- [ ] Module library/palette
- [ ] Scene preview component
- [ ] Live scene switcher panel
- [ ] Scene edit during live event

### Phase 4: Audience Real-Time Rendering

- [ ] Live state listener hook (`useEventLiveState`)
- [ ] Scene renderer component
- [ ] Module renderer components
- [ ] Scene transition animations (optional)
- [ ] Error handling (scene not found, network issues)

### Phase 5: Templates & Reusability

- [ ] Mark scenes as templates
- [ ] Template gallery/library
- [ ] Copy scenes between events
- [ ] Organization-level templates

### Phase 6: Analytics & History

- [ ] Scene switch logging
- [ ] Viewer engagement per scene
- [ ] Scene performance metrics

---

## Technical Considerations

### Firestore Security Rules

```javascript
// Scenes collection
match /scenes/{sceneId} {
  // Anyone in the organization can read scenes
  allow read: if isOrgMember(resource.data.organizationId);

  // Must have events:manage_modules permission to create/edit
  allow create, update: if isOrgMember(request.resource.data.organizationId)
                        && hasPermission('events:manage_modules');

  // Only delete non-template scenes or with events:delete permission
  allow delete: if isOrgMember(resource.data.organizationId)
                && (!resource.data.isTemplate || hasPermission('events:delete'));
}

// Event live state
match /events/{eventId}/live/state {
  // Anyone can read (audience members need this)
  allow read: if true;

  // Only organization members can update
  allow write: if isEventOrgMember(eventId)
               && hasPermission('events:manage_modules');
}
```

### Jitter Considerations

**Scene switches do NOT require jitter** because:

1. Only ONE write per switch (updating `/events/{eventId}/live/state`)
2. Not a burst of 5,000 concurrent writes from users
3. Single-origin write from creator dashboard

**Module interactions (Q&A, polls) will still need jitter** when we implement those.

### Branded Types

```typescript
// Add to packages/core/src/types/branded.ts
export type SceneId = Brand<string, "SceneId">;
export type ModuleInstanceId = Brand<string, "ModuleInstanceId">;

// Module types
export type ModuleType =
  | "welcome"
  | "qna"
  | "poll"
  | "countdown"
  | "sponsor"
  | "video"
  | "image";
```

---

## Future Enhancements (Not MVP)

### Live Module Overrides

Allow temporary visibility toggles without switching scenes:

```typescript
// Add to EventLiveState
moduleOverrides?: {
  [moduleId: string]: {
    visible: boolean,
    order?: number
  }
}
```

### Scene Transitions

- Fade between scenes
- Slide animations
- Custom transition effects

### Advanced Module Features

- Picture-in-picture (multiple modules visible)
- Region-based layouts (header, main, footer)
- Conditional visibility (show module only to certain segments)

### Collaboration Features

- Multi-user editing (operational transforms)
- Scene comments/notes
- Version history for scenes

---

## Open Questions

1. **Scene storage pattern**: Top-level `/scenes/{sceneId}` or subcollection `/events/{eventId}/scenes/{sceneId}`?
   - **Recommendation**: Top-level for easier templating and cross-event queries
2. **Module registry**: Should modules self-register or use a centralized registry?
   - **Recommendation**: Centralized registry in `packages/core` for type safety

3. **Scene limits**: Max number of scenes per event?
   - **Recommendation**: 50 scenes per event (soft limit in UI, no hard Firestore constraint)

4. **Default scene**: What displays if no scene is active?
   - **Recommendation**: Empty state with event branding ("Waiting for the show to start...")

---

## Related Documentation

- [DOMAIN_MODEL.md](../DOMAIN_MODEL.md) - See Interaction Domain
- [PERMISSIONS.md](../PERMISSIONS.md) - `events:manage_modules` permission
- [DEVELOPER_STANDARDS.md](../DEVELOPER_STANDARDS.md) - Real-time patterns and jitter usage

---

## Implementation Tracking

See [ROADMAP.md](../ROADMAP.md) for sprint planning and progress updates.
