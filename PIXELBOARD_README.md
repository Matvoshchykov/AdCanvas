# 🎨 Whop PixelBoard

A collaborative pixel art canvas inspired by Reddit's r/place, built specifically for Whop communities. Users can place colored pixels with promotional links to showcase their communities and products.

## ✨ Features

- **200×200 Pixel Grid** - Shared canvas where every pixel tells a story
- **Cooldown System** - Each user can place 1 pixel every 10 minutes
- **Promotional Links** - Attach URLs to pixels to promote communities/products
- **Real-time Updates** - See pixels appear instantly as others place them
- **Zoom & Pan** - Navigate the canvas with smooth controls
- **Dark Theme** - Sleek, modern UI with gaming aesthetics
- **Whop Integration** - Native authentication and user management
- **Permanent Pixels** - Once placed, pixels cannot be removed or changed

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ and pnpm
- Whop Developer account
- Supabase account

### 2. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run the contents of `supabase-setup.sql`
3. Enable Realtime for the `pixels` table in Database > Replication
4. Copy your project URL and API keys

### 3. Configure Environment Variables

Create a `.env` file in the project root:

\`\`\`bash
# Whop Configuration (from your Whop Developer Dashboard)
WHOP_API_KEY=your_whop_api_key
NEXT_PUBLIC_WHOP_AGENT_USER_ID=your_agent_user_id
NEXT_PUBLIC_WHOP_APP_ID=your_app_id
NEXT_PUBLIC_WHOP_COMPANY_ID=your_company_id

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

### 4. Install Dependencies

\`\`\`bash
pnpm install
\`\`\`

### 5. Run Development Server

\`\`\`bash
pnpm dev
\`\`\`

Visit `http://localhost:3000` to see the PixelBoard!

## 🎮 How to Play

1. **Select a Position** - Click any empty cell on the grid
2. **Choose a Color** - Pick from presets or use the custom color picker
3. **Add a Link** (optional) - Promote your community or product
4. **Place Pixel** - Click the "Place Pixel" button
5. **Wait for Cooldown** - 10 minutes until your next placement
6. **Explore** - Click on existing pixels to see their info and links

## 🏗️ Architecture

### Frontend Components

- **`PixelGrid.tsx`** - Canvas component with zoom/pan and real-time rendering
- **`PixelModal.tsx`** - Modal for displaying pixel information
- **`PlacementPanel.tsx`** - UI for color selection and pixel placement

### Backend API Routes

- **`/api/pixels/place`** - Handle pixel placement with validation
- **`/api/pixels/cooldown`** - Check user cooldown status

### Database Schema

- **`pixels`** - Stores all placed pixels (x, y, color, link, owner)
- **`user_cooldowns`** - Tracks last placement time per user

### Real-time Features

- Supabase Realtime for instant pixel updates
- WebSocket connection for live notifications
- Optimistic UI updates for smooth UX

## 🎨 Customization

### Change Grid Size

Edit `GRID_SIZE` constant in `app/pixelboard/page.tsx` and the SQL schema:

\`\`\`typescript
const GRID_SIZE = 200; // Change to desired size
\`\`\`

### Adjust Cooldown Time

Edit `COOLDOWN_MINUTES` in API routes:

\`\`\`typescript
const COOLDOWN_MINUTES = 10; // Change to desired minutes
\`\`\`

### Customize Colors

Edit the dark theme colors in components or `globals.css`:

\`\`\`css
background: #0e0e10; /* Main background */
--gray-900: #1a1a1d; /* Card background */
--gray-800: #2a2a2d; /* Border color */
\`\`\`

## 📦 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Database**: Supabase (PostgreSQL + Realtime)
- **Auth**: Whop SDK
- **Color Picker**: react-colorful
- **Date Handling**: date-fns

## 🔒 Security Features

- Backend validation for all pixel placements
- Row Level Security (RLS) in Supabase
- Cooldown enforcement on server-side
- URL validation for links
- Coordinate bounds checking

## 🐛 Troubleshooting

### Pixels not appearing in real-time?

- Check that Realtime is enabled for `pixels` table in Supabase
- Verify your Supabase URL and keys are correct
- Check browser console for WebSocket connection errors

### Cooldown not working?

- Ensure `user_cooldowns` table exists and has proper policies
- Check that the database trigger is created (see `supabase-setup.sql`)
- Verify user ID is consistent across requests

### Can't place pixels?

- Check that all environment variables are set
- Verify Supabase service role key has proper permissions
- Check browser console and server logs for error messages

## 📄 License

This project is part of the Whop app ecosystem. Refer to your Whop Developer Agreement for licensing terms.

## 🤝 Contributing

Built for Whop communities. Feel free to customize and extend for your specific use case!

## 📞 Support

- [Whop Developer Docs](https://dev.whop.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Made with ❤️ for Whop Communities**

