# BAITOAPP Production Roadmap (Phase 1)

## What is added in this phase
- Firestore Security Rules (`firestore.rules`)
- Firestore Index config (`firestore.indexes.json`)
- Cloud Functions scaffold (`functions/`)
- Firebase config update (`firebase.json`)

## Why
- Move critical logic from client to server progressively.
- Prevent unauthorized access/updates by strict rules.
- Prepare notification and analytics backend.

## Deploy steps
1. Install dependencies for functions
   - `cd functions && npm install`
2. Deploy rules/indexes/functions
   - `firebase deploy --only firestore:rules,firestore:indexes,functions`
3. Deploy hosting
   - `firebase deploy --only hosting`

## Notes
- Current app still contains some client-side business logic. This phase introduces server-side endpoints and triggers without breaking current UI.
- Next phase should migrate status automation and dashboard KPIs to callable functions entirely.
- For real push notifications, connect notificationQueue with FCM sender (Cloud Function or extension).

## Added server functions
- `onMessageCreated`
  - Keeps conversation summary/unread counters in sync.
- `onApplicationStatusChanged`
  - Adds automatic status message to chat on status transition.
- `onConversationWrite`
  - Writes lightweight events to `notificationQueue`.
- `getAdminDashboard` (callable)
  - Returns aggregated KPI payload.
