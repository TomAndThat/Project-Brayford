# Project Brayford

A modular, real-time “second screen” interaction platform designed for live experiential events, such as podcast recordings and creator shows. The platform transforms passive audiences into active participants while providing creators with deep engagement tools and marketing data.

Project Brayford is a project title, in place while we come up with a public-facing brand identity.

## 1. Core Concept & Vision

The platform bridges the gap between the stage and the seats. Audiences gain intimacy and influence via a low-friction mobile web experience, while creators manage the “show flow” and visualize audience sentiment on-stage in real time.

### Primary Goals

- **Intimacy:** Allow audience members to interact directly with their favorite creators.
- **Engagement:** Facilitate real-time feedback loops (Q&A, polling).
- **Marketing:** Provide creators with lead generation and audience research tools (gated content, surveys).
- **Production:** Offer a seamless “Vision Mixer” experience to broadcast interaction results to big screens.

## 2. System Architecture (The 4+1 Model)

The project is structured into four distinct user-facing applications supported by a shared core engine.

### The Applications (`/apps`)

- **Audience App:** A zero-friction, mobile-optimized web interface.
  - Entry: QR code scan.
  - Identity: Anonymous by default; optional email-capture gating for exclusive content.
- **Creator Dashboard:** The production command center.
  - Functions: Toggling modules (starting/stopping polls), moderating Q&A, and managing the “Vision Mixer” output.
- **Stage View:** A clean, high-resolution output for big screens or stream overlays.
  - Functions: Real-time visualization of active interaction modules (e.g., live poll results, featured questions).
- **Platform Admin:** Internal tool for global management.
  - Functions: Organization onboarding, user management, billing, and platform-wide monitoring.

### The Engine (`/packages`)

- **Marketing & Core Service:** The “circulatory system” of the app. Handles data persistence, email capture, lead-magnet delivery, and analytics export.

## 3. Technical Stack

- **Framework:** Next.js (deployed on Vercel for serverless scaling).
- **Database:**
  - **Firebase Firestore:** Primary store for event state, Q&A, and structured participant data.
  - **Firebase Realtime Database (optional):** Optimized for high-frequency low-latency pings (e.g., live “applause” meters).
- **Real-time Protocol:** Firestore `onSnapshot` subscriptions to ensure sub-second syncing between Dashboard, Audience, and Stage.
- **Authentication:** Firebase Auth (anonymous entry with later email linking/promotion).

## 4. Interaction Modules (MVP Scope)

To ensure extensibility, interactions are treated as modular “plugins”:

- **Q&A Module:** Text submission with moderation and “Push to Stage” functionality.
- **Voting/Polling:** Real-time choice-based sentiment.
- **Lead Magnet:** Gated access to exclusive digital content in exchange for email.
- **Survey/Research:** Structured data collection disguised as participation.

## 5. Performance & Scaling Strategy

### High Concurrency Handling (The “Hammersmith” Scale)

The system is designed to handle bursts of 5,000+ concurrent participants per event.

- **Jitter/Request Staggering:** To avoid “Thundering Herd” spikes during “Vote Now!” moments, client writes are randomized across a 1–2 second window to stay within database write limits.
- **Multi-Event Concurrency:** Use of `eventId` partitioning ensures multiple large-scale shows can run simultaneously on the shared infrastructure without cross-talk or performance degradation.
- **Sharding:** Architecture supports future sharding of Firebase instances should global concurrency exceed single-instance limits.

## 6. Repository Structure

```
/root
  /apps
    /audience       # The mobile participant experience
    /creator        # The production/vision-mixer dashboard
    /stage-view     # High-res projector/big-screen output
    /platform-admin # Internal platform management
  /packages
    /core           # Shared schemas, types, and marketing logic
    /firebase-utils # Standardized real-time hooks and jitter logic
```
