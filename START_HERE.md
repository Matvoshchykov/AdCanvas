# 🎨 Welcome to PixelBoard!

## 🎉 What You've Got

A **complete, production-ready** collaborative pixel art game for Whop communities! 

Think Reddit's r/place, but for your Whop users to promote their communities and products.

---

## ✨ Key Features (All Implemented!)

✅ **200×200 Interactive Canvas** with zoom and pan  
✅ **10-Minute Cooldown System** (server-enforced)  
✅ **Real-time Updates** - see pixels appear instantly  
✅ **Promotional Links** - each pixel can link to content  
✅ **Dark Theme UI** - sleek, modern gaming aesthetic  
✅ **Whop Authentication** - native user integration  
✅ **Permanent Pixels** - once placed, they stay forever  
✅ **Mobile Responsive** - works on all devices  

---

## 🚀 Get Started (Choose Your Path)

### ⚡ Super Quick (5 min) → `QUICK_START.md`
Just want to see it running? Start here!

### 📖 Detailed Setup (15 min) → `SETUP_GUIDE.md`
Step-by-step with screenshots and troubleshooting.

### 🏗️ Understand the Code → `ARCHITECTURE.md`
System diagrams, data flow, and technical details.

### 📚 Full Documentation → `PROJECT_SUMMARY.md`
Everything about features, customization, and deployment.

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `supabase-setup.sql` | Database schema - run this in Supabase |
| `.env.local.example` | Template for your environment variables |
| `app/pixelboard/page.tsx` | Main game page |
| `components/PixelGrid.tsx` | The interactive canvas |
| `components/PlacementPanel.tsx` | Color picker & controls |
| `components/PixelModal.tsx` | Pixel info display |
| `app/api/pixels/place/route.ts` | Pixel placement API |

---

## ⚙️ Quick Setup Checklist

1. [ ] Create Supabase project
2. [ ] Run `supabase-setup.sql` in SQL Editor
3. [ ] Enable Realtime for `pixels` table
4. [ ] Create Whop app in developer dashboard
5. [ ] Copy `.env.local.example` to `.env.local`
6. [ ] Fill in all environment variables
7. [ ] Run `pnpm install`
8. [ ] Run `pnpm dev`
9. [ ] Visit `http://localhost:3000`
10. [ ] Place your first pixel! 🎉

---

## 🎮 How It Works

1. **Click** any empty grid cell to select it
2. **Choose** a color from presets or custom picker
3. **Add** an optional promotional link
4. **Place** the pixel (if not on cooldown)
5. **Wait** 10 minutes before placing another
6. **Click** existing pixels to see their info and links

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion
- **Database**: Supabase (PostgreSQL + Realtime)
- **Auth**: Whop SDK
- **Deployment**: Vercel (recommended)

---

## 📊 What's Included

### Components (3)
- ✅ PixelGrid - Interactive canvas with zoom/pan
- ✅ PixelModal - Click to view pixel details
- ✅ PlacementPanel - Color picker & placement UI

### API Routes (2)
- ✅ POST /api/pixels/place - Place pixels with validation
- ✅ GET /api/pixels/cooldown - Check cooldown status

### Database Tables (2)
- ✅ pixels - All placed pixels
- ✅ user_cooldowns - Placement timing

### Pages (2)
- ✅ / - Auto-redirects to PixelBoard
- ✅ /pixelboard - Main game interface

### Documentation (5)
- ✅ QUICK_START.md - 5-minute setup
- ✅ SETUP_GUIDE.md - Detailed instructions
- ✅ ARCHITECTURE.md - Technical documentation
- ✅ PROJECT_SUMMARY.md - Complete feature list
- ✅ PIXELBOARD_README.md - User-facing docs

---

## 🎨 Customization

### Change Grid Size
Edit `GRID_SIZE` in `app/pixelboard/page.tsx`:
\`\`\`typescript
const GRID_SIZE = 200; // Change to 500, 1000, etc.
\`\`\`

### Change Cooldown Duration
Edit `COOLDOWN_MINUTES` in API routes:
\`\`\`typescript
const COOLDOWN_MINUTES = 10; // Change to 5, 15, etc.
\`\`\`

### Add More Color Presets
Edit `PRESET_COLORS` in `components/PlacementPanel.tsx`

### Change Theme Colors
- Main BG: `#0e0e10`
- Cards: `#1a1a1d`
- Borders: `#2a2a2d`

---

## 🐛 Troubleshooting

**Pixels not loading?**
→ Check Supabase URL and keys in `.env.local`

**Real-time not working?**
→ Enable Realtime for `pixels` table in Supabase

**Cooldown not enforcing?**
→ Verify `user_cooldowns` table exists and trigger is created

**TypeScript errors?**
→ Run `pnpm install` again

**More issues?**
→ See `SETUP_GUIDE.md` troubleshooting section

---

## 🚀 Deploy to Production

### Recommended: Vercel

1. Push code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Import repository
4. Add environment variables
5. Deploy! 🎊

Takes ~2 minutes and it's free!

---

## 🎯 Next Steps

### Immediate
1. ✅ Read `QUICK_START.md`
2. ✅ Set up Supabase
3. ✅ Configure environment variables
4. ✅ Run locally
5. ✅ Test pixel placement
6. ✅ Deploy to Vercel

### Future Enhancements
- User profiles & stats
- Leaderboard system
- Export canvas as PNG
- Multiple themed boards
- Admin moderation tools
- Link click analytics

---

## 📞 Support Resources

- **Whop Docs**: [dev.whop.com](https://dev.whop.com)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)

---

## ✅ Quality Checklist

- ✅ **No linting errors** - Clean TypeScript
- ✅ **Type-safe** - Full TypeScript coverage
- ✅ **Responsive** - Works on mobile & desktop
- ✅ **Secure** - Server-side validation
- ✅ **Fast** - Optimized canvas rendering
- ✅ **Real-time** - Instant updates via WebSocket
- ✅ **Well-documented** - Inline comments everywhere
- ✅ **Production-ready** - Deploy today!

---

## 🎊 You're Ready!

Everything is set up and ready to go. Just follow `QUICK_START.md` and you'll have a working PixelBoard in 5 minutes!

**Happy pixel placing! 🎨✨**

---

*Built with ❤️ for Whop Communities*

