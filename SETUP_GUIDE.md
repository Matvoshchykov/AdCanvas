# 🚀 PixelBoard Setup Guide

Follow these steps to get your PixelBoard up and running!

## Step 1: Set Up Supabase Database

### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in project details:
   - Name: `pixelboard` (or your choice)
   - Database Password: Create a strong password
   - Region: Choose closest to your users
4. Wait for the project to be created (~2 minutes)

### Run Database Setup SQL
1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy the entire contents of `supabase-setup.sql` from this project
4. Paste into the SQL editor
5. Click "Run" or press `Ctrl+Enter`
6. Verify success - you should see "Success. No rows returned"

### Enable Realtime
1. Go to **Database** → **Replication** in the left sidebar
2. Find the `pixels` table
3. Toggle it **ON** (this enables real-time updates)
4. Verify `user_cooldowns` is also enabled if you want real-time cooldown sync

### Get Your Supabase Keys
1. Go to **Settings** → **API** (in left sidebar)
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: Starts with `eyJ...`
   - **service_role key**: ⚠️ **KEEP THIS SECRET** - only use server-side

## Step 2: Set Up Whop App

### Create Whop App
1. Go to [Whop Dashboard](https://whop.com/dashboard)
2. Navigate to **Apps** in the sidebar
3. Click "Create App" or "New App"
4. Fill in app details:
   - Name: "PixelBoard"
   - Description: "Collaborative pixel art canvas"
   - Category: Game/Community

### Get Whop Credentials
From your Whop app dashboard, copy:
- **App ID**: `app_xxxxx`
- **API Key**: Keep this secret
- **Agent User ID**: Create one if needed
- **Company ID**: Your company/organization ID

## Step 3: Configure Environment Variables

Create a `.env.local` file in the `pixel-game` directory:

\`\`\`bash
# Whop Configuration
WHOP_API_KEY=your_whop_api_key_from_dashboard
NEXT_PUBLIC_WHOP_AGENT_USER_ID=user_xxxxxxxxxxxxx
NEXT_PUBLIC_WHOP_APP_ID=app_xxxxxxxxxxxxx
NEXT_PUBLIC_WHOP_COMPANY_ID=biz_xxxxxxxxxxxxx

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

⚠️ **Important**: 
- Never commit `.env.local` to git
- The `SUPABASE_SERVICE_ROLE_KEY` has full database access - keep it secret!
- All keys starting with `NEXT_PUBLIC_` are exposed to the browser

## Step 4: Install Dependencies

Make sure you have Node.js 18+ and pnpm installed.

\`\`\`bash
cd pixel-game
pnpm install
\`\`\`

If you encounter errors, try:
\`\`\`bash
pnpm install --force
\`\`\`

## Step 5: Run Development Server

\`\`\`bash
pnpm dev
\`\`\`

The app should start at `http://localhost:3000`

You'll see:
- Automatic redirect to `/pixelboard`
- A 200×200 pixel grid
- Color picker and placement controls
- Your username in the top right

## Step 6: Test the App

### Place Your First Pixel
1. Click on any empty grid cell
2. Choose a color from the palette or use the custom picker
3. (Optional) Add a promotional link
4. Click "Place Pixel"
5. Success! You'll see a cooldown timer

### Test Real-time Updates
1. Open the app in two browser windows (or two devices)
2. Place a pixel in one window
3. Watch it appear instantly in the other window! 🎉

### Test Cooldown
1. Try to place another pixel immediately
2. You should see "Cooldown: 9:XX" on the button
3. The button is disabled until cooldown expires

## Step 7: Deploy to Production

### Option A: Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Add environment variables (same as `.env.local`)
6. Click "Deploy"
7. Your app will be live in ~2 minutes!

### Option B: Deploy to Other Platforms

The app is a standard Next.js app and can be deployed to:
- Railway
- Render
- AWS Amplify
- Netlify
- DigitalOcean App Platform

Just make sure to:
- Set all environment variables
- Use Node.js 18+
- Run `pnpm build` before starting

## Troubleshooting

### "Failed to load pixels"
- Check your Supabase URL and anon key
- Verify the `pixels` table exists
- Check browser console for specific error

### "Cooldown active" even though it's been > 10 minutes
- Check your system clock is correct
- Verify database timezone settings
- Clear the `user_cooldowns` table for testing:
  \`\`\`sql
  DELETE FROM user_cooldowns WHERE user_id = 'your_user_id';
  \`\`\`

### Pixels not appearing in real-time
- Verify Realtime is enabled for `pixels` table
- Check WebSocket connection in browser Network tab
- Ensure Supabase project is not paused (free tier pauses after inactivity)

### "Cannot find module" errors
- Run `pnpm install` again
- Delete `node_modules` and `.next` folders, then reinstall
- Make sure you're in the `pixel-game` directory

### TypeScript errors
- Run `pnpm build` to see full error messages
- Check that all imports use `@/` prefix (e.g., `@/lib/supabase`)
- Verify `tsconfig.json` has proper path mappings

## Customization Tips

### Change Grid Size
Edit `GRID_SIZE` in `app/pixelboard/page.tsx`:
\`\`\`typescript
const GRID_SIZE = 500; // Make it bigger!
\`\`\`

### Change Cooldown Duration
Edit both API routes (`place/route.ts` and `cooldown/route.ts`):
\`\`\`typescript
const COOLDOWN_MINUTES = 5; // Faster placement
\`\`\`

### Add More Preset Colors
Edit `PRESET_COLORS` in `components/PlacementPanel.tsx`:
\`\`\`typescript
const PRESET_COLORS = [
  '#FF0000', '#00FF00', '#0000FF',
  // Add more hex colors here
];
\`\`\`

### Change Theme Colors
Edit the background colors in components:
- Main BG: `#0e0e10`
- Card BG: `#1a1a1d`
- Borders: `#2a2a2d`

## Security Checklist

Before going to production:

- [ ] Set strong Supabase database password
- [ ] Enable Row Level Security (RLS) on all tables ✅ (already done in SQL)
- [ ] Keep `SUPABASE_SERVICE_ROLE_KEY` secret (never expose to browser)
- [ ] Add rate limiting to API routes (optional)
- [ ] Set up Supabase auth for production users (optional)
- [ ] Enable HTTPS (automatic with Vercel)
- [ ] Set up monitoring (Vercel Analytics, Sentry, etc.)

## Next Steps

Your PixelBoard is now ready! Here are some ideas to extend it:

1. **User Profiles**: Show user stats (pixels placed, links clicked)
2. **Leaderboard**: Top contributors, most popular links
3. **Themes**: Let users choose light/dark theme
4. **Export**: Allow users to download the canvas as PNG
5. **History**: View canvas at different points in time
6. **Animations**: Add particle effects when pixels are placed
7. **Teams**: Allow companies to collaborate on pixel art

## Need Help?

- Check `PIXELBOARD_README.md` for detailed feature documentation
- Review the code comments in each component
- Check [Whop Developer Docs](https://dev.whop.com)
- Check [Supabase Documentation](https://supabase.com/docs)

Happy pixel placing! 🎨✨

