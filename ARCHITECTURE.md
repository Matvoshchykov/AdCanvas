# 🏗️ PixelBoard Architecture

## System Overview

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                     Whop Platform                            │
│                  (Authentication & Users)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Application                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  app/page.tsx  →  redirects to  →  /pixelboard      │   │
│  └─────────────────────────────────────────────────────┘   │
│                       │                                      │
│                       ▼                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           app/pixelboard/page.tsx                    │   │
│  │        (Main Game Page - Orchestrator)               │   │
│  │                                                       │   │
│  │  • Fetches pixels from Supabase                      │   │
│  │  • Subscribes to real-time updates                   │   │
│  │  • Manages state (selectedPosition, cooldown)        │   │
│  │  • Handles user authentication via Whop             │   │
│  │  • Coordinates child components                      │   │
│  └────┬────────────────────┬────────────────────┬──────┘   │
│       │                    │                    │           │
│       ▼                    ▼                    ▼           │
│  ┌─────────┐      ┌──────────────┐     ┌─────────────┐    │
│  │ Pixel   │      │  Placement   │     │   Pixel     │    │
│  │ Grid    │      │    Panel     │     │   Modal     │    │
│  │         │      │              │     │             │    │
│  │ Canvas  │◄────►│ Color Picker │     │ Info Display│    │
│  │ Zoom/Pan│      │ Link Input   │     │ Click Links │    │
│  └─────────┘      └──────────────┘     └─────────────┘    │
│       │                    │                                │
│       └────────────────────┼────────────────────────────────┘
│                            │
│                            ▼
│           ┌────────────────────────────────┐
│           │    API Routes (Backend)         │
│           ├────────────────────────────────┤
│           │ POST /api/pixels/place         │
│           │  • Validate coordinates         │
│           │  • Check cooldown               │
│           │  • Insert pixel                 │
│           │  • Update cooldown              │
│           │                                 │
│           │ GET /api/pixels/cooldown       │
│           │  • Check user's last placement  │
│           │  • Calculate remaining time     │
│           └────────────┬───────────────────┘
│                        │
└────────────────────────┼───────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (Backend)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                     │   │
│  │  ┌──────────────┐          ┌─────────────────┐     │   │
│  │  │   pixels     │          │ user_cooldowns  │     │   │
│  │  ├──────────────┤          ├─────────────────┤     │   │
│  │  │ id           │          │ user_id (PK)    │     │   │
│  │  │ x, y (UNIQUE)│          │ last_placement  │     │   │
│  │  │ color        │          │ created_at      │     │   │
│  │  │ link         │          └─────────────────┘     │   │
│  │  │ owner_id     │                                   │   │
│  │  │ owner_name   │          Triggers:                │   │
│  │  │ created_at   │          • update_cooldown()     │   │
│  │  └──────────────┘          • After INSERT on pixels│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Supabase Realtime (WebSocket)              │   │
│  │                                                      │   │
│  │  Broadcasts: INSERT events on 'pixels' table        │   │
│  │  Listeners: All connected browser clients            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
\`\`\`

---

## Data Flow

### 1. Initial Page Load

\`\`\`
User visits app
     ↓
Whop authenticates user
     ↓
app/page.tsx redirects to /pixelboard
     ↓
pixelboard/page.tsx loads
     ↓
Fetch all pixels from Supabase
     ↓
Render PixelGrid with existing pixels
     ↓
Check user cooldown status
     ↓
Subscribe to real-time updates
\`\`\`

### 2. Placing a Pixel

\`\`\`
User clicks empty grid cell
     ↓
selectedPosition state updated
     ↓
PlacementPanel shows coordinates
     ↓
User picks color and optional link
     ↓
User clicks "Place Pixel" button
     ↓
POST /api/pixels/place
     ↓
Backend validates:
  • Coordinates in bounds?
  • Color format valid?
  • Position empty?
  • User off cooldown?
     ↓
If valid:
  INSERT INTO pixels
  UPDATE user_cooldowns
     ↓
Database trigger updates cooldown
     ↓
Response: { success: true, cooldownEnd: "..." }
     ↓
UI updates:
  • Clear selected position
  • Set cooldown timer
  • Show success toast
     ↓
Realtime broadcasts new pixel
     ↓
All connected clients receive update
     ↓
PixelGrid re-renders with new pixel
\`\`\`

### 3. Real-time Updates (Other Users)

\`\`\`
User A places pixel
     ↓
Database INSERT triggers Realtime event
     ↓
Supabase broadcasts to all subscribers
     ↓
User B's browser receives WebSocket message
     ↓
pixels state updated with new pixel
     ↓
PixelGrid re-renders automatically
     ↓
Toast notification: "User A placed pixel at (X,Y)"
\`\`\`

### 4. Viewing Pixel Info

\`\`\`
User clicks filled pixel
     ↓
PixelGrid.onPixelClick(pixel, x, y)
     ↓
selectedPixel state updated
     ↓
isModalOpen set to true
     ↓
PixelModal renders with animation
     ↓
Shows: owner, color, timestamp, link
     ↓
User clicks link (if present)
     ↓
Opens in new tab
\`\`\`

---

## Component Hierarchy

\`\`\`
app/layout.tsx
  └── WhopApp (Whop authentication provider)
      └── app/pixelboard/page.tsx
          ├── Header
          │   ├── Logo
          │   └── User Info
          │
          ├── PixelGrid
          │   ├── Canvas Element
          │   ├── Zoom Controls
          │   └── Instructions
          │
          ├── PlacementPanel
          │   ├── Position Display
          │   ├── Color Picker
          │   │   ├── Preset Colors Grid
          │   │   ├── Custom HEX Input
          │   │   └── HexColorPicker (react-colorful)
          │   ├── Link Input
          │   └── Place Button (with cooldown)
          │
          ├── PixelModal (conditional)
          │   ├── Color Header
          │   ├── Position Info
          │   ├── Color Display
          │   ├── Owner Info
          │   ├── Timestamp
          │   ├── Link Button (if link exists)
          │   └── Close Button
          │
          ├── Stats Panel
          │   ├── Pixels Placed
          │   ├── Canvas Filled %
          │   └── Contributors Count
          │
          └── Toast Notification (conditional)
\`\`\`

---

## State Management

### Global State (pixelboard/page.tsx)

\`\`\`typescript
const [pixels, setPixels] = useState<Pixel[]>([])
  // All pixels on the canvas
  // Updated on initial load and real-time events

const [selectedPosition, setSelectedPosition] = useState<{x, y} | null>(null)
  // Currently selected empty cell
  // Set by clicking empty grid cell

const [selectedPixel, setSelectedPixel] = useState<Pixel | null>(null)
  // Clicked existing pixel for info modal
  // Set by clicking filled grid cell

const [isModalOpen, setIsModalOpen] = useState(false)
  // Controls PixelModal visibility

const [cooldownEnd, setCooldownEnd] = useState<Date | null>(null)
  // When user can place next pixel
  // Fetched on load and updated after placement

const [isPlacing, setIsPlacing] = useState(false)
  // Loading state during pixel placement

const [toast, setToast] = useState<{message, type} | null>(null)
  // Toast notification display
\`\`\`

### Component-Specific State

**PixelGrid**:
\`\`\`typescript
const [scale, setScale] = useState(2)          // Zoom level
const [offset, setOffset] = useState({x, y})   // Pan position
const [isDragging, setIsDragging] = useState() // Pan interaction
\`\`\`

**PlacementPanel**:
\`\`\`typescript
const [color, setColor] = useState('#FF0000')  // Selected color
const [link, setLink] = useState('')           // Optional link
const [showColorPicker, setShowColorPicker]()  // Custom picker toggle
const [timeRemaining, setTimeRemaining]()      // Cooldown countdown
\`\`\`

---

## API Endpoints

### POST /api/pixels/place

**Request**:
\`\`\`json
{
  "x": 50,
  "y": 100,
  "color": "#FF0000",
  "link": "https://example.com",
  "userId": "user_12345",
  "userName": "Alice"
}
\`\`\`

**Success Response (200)**:
\`\`\`json
{
  "success": true,
  "pixel": { /* full pixel object */ },
  "cooldownEnd": "2025-10-18T12:30:00Z"
}
\`\`\`

**Error Responses**:
- `400`: Invalid input (bad coordinates, color format, URL)
- `409`: Position already occupied
- `429`: Cooldown active

### GET /api/pixels/cooldown?userId=user_123

**Success Response (200)**:
\`\`\`json
{
  "canPlace": false,
  "cooldownEnd": "2025-10-18T12:30:00Z",
  "remainingMinutes": 7
}
\`\`\`

---

## Database Relationships

\`\`\`
pixels.owner_id ────────► user (from Whop)
                            │
                            │ user_id
                            ▼
                       user_cooldowns.user_id

Trigger: After INSERT on pixels
  → Automatically updates user_cooldowns.last_placement
\`\`\`

---

## Real-time Architecture

\`\`\`
┌────────────┐         WebSocket          ┌──────────────┐
│  Browser A │◄──────────────────────────►│   Supabase   │
└────────────┘                             │   Realtime   │
                                           │   Server     │
┌────────────┐         WebSocket          └──────────────┘
│  Browser B │◄──────────────────────────►        ▲
└────────────┘                                     │
                                                   │
┌────────────┐         WebSocket          PostgreSQL
│  Browser C │◄──────────────────────────►  NOTIFY
└────────────┘                                     │
                                                   │
                                            pixels table
                                           INSERT/UPDATE

When any browser inserts a pixel:
1. PostgreSQL INSERT succeeds
2. PostgreSQL sends NOTIFY event
3. Supabase Realtime server receives it
4. Server broadcasts to all WebSocket connections
5. All browsers receive update instantly
\`\`\`

---

## Security Layers

### 1. Frontend Validation
- Check coordinates in bounds
- Verify color format
- Validate URL structure

### 2. API Route Validation
- Re-validate all inputs
- Check position availability
- Enforce cooldown (server-side)
- Prevent duplicate placements

### 3. Database Constraints
- UNIQUE(x, y) on pixels
- NOT NULL on required fields
- Data type enforcement
- Triggers for auto-updates

### 4. Supabase RLS
- Row Level Security policies
- Public read access to pixels
- Authenticated write access
- User-specific cooldown reads

---

## Performance Optimizations

### 1. Canvas Rendering
- Single `<canvas>` instead of 40k DOM elements
- Hardware-accelerated rendering
- Batched draw operations

### 2. Pixel Lookup
- `Map<string, Pixel>` for O(1) coordinate lookup
- Indexed by `"x,y"` key

### 3. Database Queries
- Indexes on (x, y) for fast lookups
- Index on user_id for cooldown checks
- SELECT only necessary columns

### 4. Real-time Efficiency
- WebSocket (not polling)
- Only INSERT events subscribed
- Automatic reconnection on disconnect

### 5. Client-side Caching
- Pixels fetched once on load
- Real-time updates incrementally add to cache
- No unnecessary re-fetches

---

## Error Handling

### Network Errors
- Try/catch on all API calls
- User-friendly error messages
- Toast notifications for feedback

### Database Errors
- Graceful degradation if Supabase down
- Connection retry logic
- Fallback to cached data

### Validation Errors
- Clear error messages in UI
- Highlight invalid inputs
- Prevent submission of bad data

### Edge Cases
- Handle user losing connection during placement
- Prevent race conditions with cooldown
- Handle duplicate placement attempts

---

## Monitoring Points

### Key Metrics to Track

1. **Placement Success Rate**
   - Total attempts vs successful placements
   - Error types distribution

2. **Cooldown Violations**
   - How many users hit cooldown
   - Timing of violation attempts

3. **Real-time Latency**
   - Time from placement to broadcast
   - WebSocket connection health

4. **Database Performance**
   - Query execution times
   - Connection pool usage

5. **User Engagement**
   - Pixels per user
   - Session duration
   - Return rate

---

## Deployment Architecture

\`\`\`
┌─────────────┐
│   Vercel    │  (Hosting)
│   Edge      │  • Next.js app
│   Network   │  • API routes
│             │  • Static assets
└──────┬──────┘
       │
       ├───────────► Whop Platform (Auth)
       │
       └───────────► Supabase
                      ├─ PostgreSQL (Data)
                      ├─ Realtime (WebSocket)
                      └─ Edge Functions (optional)
\`\`\`

---

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + Next.js 15 | UI framework |
| **Styling** | Tailwind CSS v4 | Utility styling |
| **Animation** | Framer Motion | Smooth transitions |
| **Canvas** | HTML5 Canvas API | Pixel rendering |
| **Type Safety** | TypeScript | Static typing |
| **State** | React useState | Local state management |
| **Backend** | Next.js API Routes | Server endpoints |
| **Database** | PostgreSQL (Supabase) | Data persistence |
| **Real-time** | Supabase Realtime | WebSocket updates |
| **Auth** | Whop SDK | User authentication |
| **Hosting** | Vercel | Deployment platform |

---

**This architecture enables real-time collaborative pixel art at scale! 🎨**

