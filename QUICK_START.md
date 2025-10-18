# ⚡ PixelBoard - Quick Start (5 Minutes)

## 1️⃣ Set Up Supabase (2 min)

1. Go to [supabase.com](https://supabase.com) → "New Project"
2. SQL Editor → New Query → Paste contents of `supabase-setup.sql` → Run
3. Database → Replication → Enable `pixels` table
4. Settings → API → Copy Project URL and anon key

## 2️⃣ Set Up Whop (1 min)

1. [Whop Dashboard](https://whop.com/dashboard) → Apps → Create App
2. Copy: App ID, API Key, Agent User ID, Company ID

## 3️⃣ Configure Environment (1 min)

Create `pixel-game/.env.local`:

\`\`\`bash
WHOP_API_KEY=your_key
NEXT_PUBLIC_WHOP_AGENT_USER_ID=user_xxx
NEXT_PUBLIC_WHOP_APP_ID=app_xxx
NEXT_PUBLIC_WHOP_COMPANY_ID=biz_xxx

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
\`\`\`

## 4️⃣ Run (1 min)

\`\`\`bash
cd pixel-game
pnpm install
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 🧪 Test It Works

1. ✅ Click empty grid cell
2. ✅ Pick a color
3. ✅ Click "Place Pixel"
4. ✅ See cooldown timer (10 min)
5. ✅ Open second browser window → see pixel appear!

---

## 🚀 Deploy to Vercel (2 min)

1. Push code to GitHub
2. [vercel.com](https://vercel.com) → Import repo
3. Add all environment variables from `.env.local`
4. Deploy! 🎊

---

## 📚 Need More Help?

- **Detailed setup**: `SETUP_GUIDE.md`
- **Features & customization**: `PIXELBOARD_README.md`
- **Architecture & code**: `PROJECT_SUMMARY.md`

---

**That's it! You're ready to go! 🎨✨**

