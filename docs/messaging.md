# Messaging System

THIMBLE's messaging system combines a REST API for history with WebSocket connections for real-time delivery. This document covers the full stack: database, backend (Go/Fiber), Next.js API routes, and React hooks.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Authentication](#authentication)
4. [Backend API (Go)](#backend-api-go)
5. [Next.js API Routes](#nextjs-api-routes)
6. [React Hooks](#react-hooks)
7. [Admin Chat](#admin-chat)
8. [Data Flow — Sending a Message](#data-flow--sending-a-message)

---

## Architecture Overview

```
Browser
  │
  ├─ REST  ──► Next.js API Routes ──► Go Backend ──► PostgreSQL
  │                  (proxy)
  └─ WebSocket ──────────────────────► Go Backend ──► PostgreSQL
                  (token in query param)
```

- **REST** is used for loading conversation lists and message history.
- **WebSocket** is used for real-time message delivery and typing indicators.
- Next.js API routes act as a thin authenticated proxy to the Go backend; they do not contain business logic.

---

## Database Schema

### `conversations`

```sql
CREATE TABLE IF NOT EXISTS conversations (
    id         BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

A conversation is simply a container. `updated_at` is bumped by the backend whenever a message is inserted (via `UPDATE conversations SET updated_at = NOW()`), so the conversation list can be sorted by most-recent activity.

---

### `conversation_participants`

```sql
CREATE TABLE IF NOT EXISTS conversation_participants (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    user_name       TEXT NOT NULL DEFAULT '',
    user_avatar     TEXT NOT NULL DEFAULT '',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);
```

Many-to-many join between users and conversations. Participant display data (name, avatar) is stored here so the conversation list can be rendered without joining the `users` table.

---

### `conversation_messages`

```sql
CREATE TABLE IF NOT EXISTS conversation_messages (
    id              BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    content         TEXT NOT NULL,
    timestamp       BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Every message sent in a conversation. `timestamp` is Unix milliseconds (matching `Date.now()` on the client). Indexed on `conversation_id` and `timestamp` for efficient message-history queries.

---

### `admin_chat_messages`

```sql
CREATE TABLE IF NOT EXISTS admin_chat_messages (
    id         BIGSERIAL PRIMARY KEY,
    user_id    TEXT NOT NULL,
    user_name  TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL,
    timestamp  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Separate table for the private admin team chat. Has no `conversation_id` — all admins share a single room.

---

## Authentication

### REST endpoints — `jwtAuth`

Standard JWT middleware. Accepts the token from:
- `Authorization: Bearer <token>` header, **or**
- `auth_token` httpOnly cookie

Extracts `userId` and stores it in `c.Locals("userId")`.

### WebSocket endpoints — `wsAuth`

Because browsers cannot add custom headers to WebSocket upgrade requests, the token is passed as a query parameter: `?token=<jwt>`.

```go
// backend/main.go
func wsAuth(c *fiber.Ctx) error {
    token := c.Query("token")
    claims, err := validateJWT(token)
    // ...
    c.Locals("userId", claims.UserID)
    return c.Next()
}
```

The frontend cannot read the `auth_token` httpOnly cookie, so it first fetches `/api/ws-token` (a Next.js route that reads the cookie server-side) to obtain the raw token, then appends it to the WebSocket URL.

### Admin WebSocket — `wsAdminAuth`

Same as `wsAuth`, plus a database check:

```go
func wsAdminAuth(c *fiber.Ctx) error {
    // ... validate JWT ...
    var isAdmin bool
    dbPool.QueryRow(ctx, "SELECT is_admin FROM users WHERE id = $1", claims.UserID).Scan(&isAdmin)
    if !isAdmin {
        return c.Status(fiber.StatusForbidden).JSON(...)
    }
    // ...
}
```

---

## Backend API (Go)

All routes are defined in `backend/main.go`.

### `GET /api/conversations`

Returns all conversations for a user, sorted by `updated_at DESC`. Each item includes the full participant list and the most recent message.

**Auth**: `jwtAuth`  
**Query param**: `userId` (optional — defaults to the authenticated user)

**Response**:
```json
[
  {
    "id": 1,
    "participants": [
      { "id": 1, "conversationId": 1, "userId": "u1", "userName": "Alice", "userAvatar": "...", "joinedAt": "..." }
    ],
    "lastMessage": { "id": 42, "conversationId": 1, "userId": "u2", "name": "Bob", "content": "Hey!", "timestamp": 1700000000000 },
    "updatedAt": "2024-01-01T12:00:00Z"
  }
]
```

---

### `POST /api/conversations`

Creates a new conversation and adds participants.

**Auth**: `jwtAuth`  
**Body**:
```json
{
  "participants": [
    { "userId": "u2", "userName": "Bob", "userAvatar": "https://..." }
  ]
}
```

The authenticated user is automatically added as the first participant. Duplicate participants are ignored (`ON CONFLICT DO NOTHING`).

**Response**: `{ "id": 7 }`

---

### `GET /api/conversations/:id/messages`

Returns the last 100 messages for a conversation, ordered by `timestamp ASC`.

**Auth**: `jwtAuth`

**Response**:
```json
[
  { "id": 1, "conversationId": 7, "userId": "u1", "name": "Alice", "content": "Hello", "timestamp": 1700000000000 }
]
```

---

### `GET /ws`

WebSocket endpoint for real-time messaging.

**Auth**: `wsAuth` (token in `?token=` query param)  
**Query params**: `conversationId`, `token`

On connect, the connection is added to `rooms[conversationId]` — a `map[*websocket.Conn]string` keyed by connection, valued by userId.

**Receiving a message**:

1. Parse incoming JSON.
2. If `"type": "typing"` — broadcast to the rest of the room without persisting.
3. Otherwise, treat as a `ConvMessage`:
   - Overwrite `UserID` with the authenticated value (prevents spoofing).
   - Set `ConversationID` from query param if missing.
   - Set `Timestamp` to `time.Now().UnixMilli()` if zero.
   - Insert into `conversation_messages`, capture the returned `id`.
   - Update `conversations.updated_at`.
   - Marshal the complete message (with real DB id) and broadcast to **all** connections in the room.

On disconnect, the connection is removed from the room.

---

## Next.js API Routes

These routes are thin authenticated proxies. They verify the session cookie, then forward the request to the Go backend using the same token.

| Route | Method | Proxies to |
|---|---|---|
| `app/api/conversations/route.ts` | GET | `GET /api/conversations` |
| `app/api/conversations/route.ts` | POST | `POST /api/conversations` |
| `app/api/conversations/[id]/messages/route.ts` | GET | `GET /api/conversations/:id/messages` |
| `app/api/ws-token/route.ts` | GET | — (reads cookie, returns token) |
| `app/api/admin/chat/route.ts` | GET | `GET /admin/chat/history` |
| `app/api/admin/ws-token/route.ts` | GET | — (reads admin cookie, returns token) |

### `/api/ws-token`

```typescript
// app/api/ws-token/route.ts
export async function GET(request: NextRequest) {
  const payload = await getUserFromToken()   // verifies the session
  if (!payload) return 401

  const token = request.cookies.get('auth_token')?.value
  return NextResponse.json({ token })
}
```

The token is safe to expose here because the session has already been verified, the token is short-lived (2 h max), and WebSocket auth is enforced server-side independently.

---

## React Hooks

### `useConversations(userId)` — `hooks/use-conversations.ts`

Fetches and manages the conversation list.

```typescript
const { conversations, isLoading, error, refresh, createConversation } = useConversations(userId)
```

| Return value | Type | Description |
|---|---|---|
| `conversations` | `Conversation[]` | Sorted by `updatedAt` desc |
| `isLoading` | `boolean` | True during the initial fetch |
| `error` | `string \| null` | Error message if fetch failed |
| `refresh()` | `() => void` | Manually re-fetch the list |
| `createConversation(participants)` | `async` | POST new conversation, then refresh |

---

### `useMessages(conversationId, userId)` — `hooks/use-conversations.ts`

Fetches message history for one conversation via REST.

```typescript
const { messages, isLoading, refresh, setMessages } = useMessages(conversationId, userId)
```

Re-fetches automatically when `conversationId` changes. Returns up to 100 messages ordered oldest-first.

---

### `useSocket(url, conversationId, user)` — `hooks/use-socket.ts`

Manages the WebSocket connection and real-time messages.

```typescript
const { messages, sendMessage, isConnected, setMessages, typingUsers, handleTyping } =
  useSocket(wsUrl, conversationId, user)
```

| Return value | Type | Description |
|---|---|---|
| `messages` | `ChatMessage[]` | Messages received over the socket this session |
| `sendMessage(content)` | `(string) => void` | Send a chat message |
| `isConnected` | `boolean` | Whether the socket is open |
| `setMessages` | `React.Dispatch` | Merge history from `useMessages` into this state |
| `typingUsers` | `Map<string, string>` | Map of `userId → userName` currently typing |
| `handleTyping()` | `() => void` | Call on every keystroke; auto-sends `isTyping: false` after 2 s |

**Connection lifecycle**:
1. When `conversationId` changes, messages and typing state are cleared.
2. `connect()` calls `GET /api/ws-token`, then opens the WebSocket.
3. If the component unmounts or `conversationId` changes, the socket is closed and the async connect is cancelled via the `cancelled` flag.

**Deduplication**: Incoming messages are only appended if their `id` is not already in the list — this prevents duplicates when the sender's own message echoes back from the server.

**Typing indicators**: The server rebroadcasts typing events to all other room members without persisting them. The frontend updates a `Map<userId, userName>` and the UI renders a "typing…" indicator.

---

## Admin Chat

The admin chat is a private channel separate from user-to-user conversations.

| Component | Location |
|---|---|
| WebSocket endpoint | `GET /admin/ws` (uses `wsAdminAuth`) |
| History endpoint | `GET /admin/chat/history` |
| Next.js proxy | `app/api/admin/chat/route.ts` |
| Token endpoint | `app/api/admin/ws-token/route.ts` |
| UI | `app/admin/chat/page.tsx` |

Key differences from user messaging:
- Single shared room (`adminRoom`) — no per-conversation isolation.
- Messages stored in `admin_chat_messages`, not `conversation_messages`.
- No typing indicators.
- `wsAdminAuth` middleware enforces `is_admin = true` at the database level.

---

## Data Flow — Sending a Message

```
User types and presses Enter
        │
        ▼
useSocket.sendMessage(content)
  → builds ChatMessage { conversationId, userId, name, content, timestamp: Date.now() }
  → socket.send(JSON)
        │
        ▼
Go /ws handler
  → overwrites userId from JWT (security)
  → fills in conversationId / timestamp if missing
  → INSERT INTO conversation_messages … RETURNING id
  → UPDATE conversations SET updated_at = NOW()
  → marshal message with real DB id
  → broadcast to all conns in rooms[conversationId]
        │
        ▼
All clients in the room (including sender)
  → onmessage fires
  → deduplicate by id
  → append to messages state
  → React re-renders chat pane
```
