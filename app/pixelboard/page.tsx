'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import PixelGrid from '@/components/PixelGrid';
import PixelModal from '@/components/PixelModal';
import PlacementControls from '@/components/PlacementControls';
import { useTheme } from '@/contexts/ThemeContext';
import type { Database } from '@/lib/database.types';

type Pixel = Database['public']['Tables']['pixels']['Row'];

const GRID_WIDTH = 600;
const GRID_HEIGHT = 400;

// Safe hook wrapper for development
function useWhopUser() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useUser } = require('@whop/react/hooks') as {
      useUser: () => { user: any; isLoading: boolean };
    };
    return useUser();
  } catch {
    // Fallback for development without Whop
    return { user: null, isLoading: false };
  }
}

export default function PixelBoardPage() {
  const { theme } = useTheme();
  const { user, isLoading: userLoading } = useWhopUser();
  
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedPixel, setSelectedPixel] = useState<Pixel | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<Date | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Get current user ID (use Whop user or fallback to mock)
  const userId = user?.id || `mock_user_${typeof window !== 'undefined' ? localStorage.getItem('mockUserId') || Math.random().toString(36).substring(7) : 'dev'}`;
  const userName = user?.username || user?.email?.split('@')[0] || userId;

  // Store mock user ID in localStorage for consistency during development
  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      const existingMockId = localStorage.getItem('mockUserId');
      if (!existingMockId) {
        const mockId = Math.random().toString(36).substring(7);
        localStorage.setItem('mockUserId', mockId);
      }
    }
  }, [user]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch initial pixels
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const fetchPixels = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('pixels')
          .select('*')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching pixels:', error);
          setPixels([]);
        } else {
          setPixels(data || []);
        }
      } catch (error) {
        console.error('Error fetching pixels:', error);
        setPixels([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPixels();
  }, []);

  // Fetch user cooldown
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      return;
    }

    const fetchCooldown = async () => {
      try {
        const response = await fetch(`/api/pixels/cooldown?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (data.cooldownEnd) {
          setCooldownEnd(new Date(data.cooldownEnd));
        } else {
          setCooldownEnd(null);
        }
      } catch (error) {
        console.error('Error fetching cooldown:', error);
      }
    };

    fetchCooldown();
  }, [userId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const channel = supabase
      .channel('pixels-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pixels',
        },
        (payload) => {
          const newPixel = payload.new as Pixel;
          setPixels((prev) => [...prev, newPixel]);
          
          // Show toast for new pixels from other users
          if (newPixel.owner_id !== userId) {
            showToast(
              `${newPixel.owner_name || 'Someone'} placed a pixel at (${newPixel.x}, ${newPixel.y})`,
              'success'
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Prevent left swipe from exiting the app on mobile
  useEffect(() => {
    const isMobile = window.innerWidth <= 768 || 'ontouchstart' in window;
    if (!isMobile) return;

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - startX;
        const deltaY = e.touches[0].clientY - startY;
        
        // Prevent left swipes that might trigger app exit
        if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -100) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Handle pixel click
  const handlePixelClick = useCallback((pixel: Pixel | null, x: number, y: number) => {
    if (pixel) {
      // Existing pixel clicked - show info modal
      setSelectedPixel(pixel);
      setIsModalOpen(true);
      setSelectedPosition(null);
    } else {
      // Empty space clicked - select for placement
      setSelectedPosition({ x, y });
      setIsModalOpen(false);
    }
  }, []);

  // Handle pixel placement
  const handlePlacePixel = async (color: string, link: string) => {
    if (!selectedPosition || isPlacing) return;

    setIsPlacing(true);

    try {
      const response = await fetch('/api/pixels/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          x: selectedPosition.x,
          y: selectedPosition.y,
          color,
          link: link || null,
          userId,
          userName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Pixel placed successfully! 🎉', 'success');
        setSelectedPosition(null);
        
        // Update cooldown
        if (data.cooldownEnd) {
          setCooldownEnd(new Date(data.cooldownEnd));
        }
      } else {
        if (response.status === 429) {
          // Cooldown active
          showToast(`Cooldown active. Wait ${data.remainingMinutes} more minute(s).`, 'error');
          if (data.cooldownEnd) {
            setCooldownEnd(new Date(data.cooldownEnd));
          }
        } else if (response.status === 409) {
          showToast('This position is already taken!', 'error');
          setSelectedPosition(null);
        } else {
          showToast(data.error || 'Failed to place pixel', 'error');
        }
      }
    } catch (error) {
      console.error('Error placing pixel:', error);
      showToast('Network error. Please try again.', 'error');
    } finally {
      setIsPlacing(false);
    }
  };

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Show setup instructions if Supabase not configured
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full bg-[#1a1a1d] border border-gray-800 rounded-xl p-8"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-3xl mx-auto mb-4">
              🎨
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to PixelBoard!</h1>
            <p className="text-gray-400">Let's get you set up</p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-[#0e0e10] border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <span className="text-2xl">1️⃣</span> Set up Supabase
              </h3>
              <ul className="text-gray-400 text-sm space-y-1 ml-8">
                <li>• Create account at <a href="https://supabase.com" target="_blank" className="text-blue-400 hover:underline">supabase.com</a></li>
                <li>• Create a new project</li>
                <li>• Run <code className="text-purple-400 bg-gray-900 px-1 rounded">supabase-setup.sql</code> in SQL Editor</li>
                <li>• Enable Realtime for the <code className="text-purple-400 bg-gray-900 px-1 rounded">pixels</code> table</li>
              </ul>
            </div>

            <div className="bg-[#0e0e10] border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <span className="text-2xl">2️⃣</span> Configure Environment
              </h3>
              <p className="text-gray-400 text-sm ml-8 mb-2">
                Create <code className="text-purple-400 bg-gray-900 px-1 rounded">.env.local</code> file in the project root:
              </p>
              <pre className="bg-gray-900 text-gray-300 p-3 rounded text-xs overflow-x-auto ml-8">
{`NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key`}
              </pre>
            </div>

            <div className="bg-[#0e0e10] border border-gray-800 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <span className="text-2xl">3️⃣</span> Restart Dev Server
              </h3>
              <p className="text-gray-400 text-sm ml-8">
                Stop the server (Ctrl+C) and run <code className="text-purple-400 bg-gray-900 px-1 rounded">pnpm dev</code> again
              </p>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <p className="text-blue-300 text-sm flex items-start gap-2">
              <span className="text-xl">📚</span>
              <span>
                <strong>Need detailed help?</strong> Check out <code className="bg-blue-900/30 px-1 rounded">QUICK_START.md</code> or <code className="bg-blue-900/30 px-1 rounded">SETUP_GUIDE.md</code> in your project folder
              </span>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isLoading || userLoading) {
    return (
      <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Loading PixelBoard...</p>
        </div>
      </div>
    );
  }

  // Show only mobile message on mobile devices
  if (isMobile) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center px-6 max-w-md">
          <div className="mb-8">
            <svg className="w-20 h-20 mx-auto text-orange-500 mb-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm8 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
            </svg>
            <h1 className="text-2xl font-bold mb-4">Desktop Required</h1>
            <p className="text-gray-300 text-lg leading-relaxed">
              This app must be accessed using a computer device for the best experience.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-gray-50 text-gray-900'
    }`}>

      {/* Main Content - Canvas fills full screen */}
      <div className="relative" style={{ height: '100vh' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`absolute inset-0 ${
                theme === 'dark' ? 'bg-zinc-900' : 'bg-gray-100'
              }`}
            >
          <PixelGrid
            pixels={pixels}
            gridWidth={GRID_WIDTH}
            gridHeight={GRID_HEIGHT}
            onPixelClick={handlePixelClick}
            selectedPosition={selectedPosition}
          />
        </motion.div>
      </div>

      {/* Floating Placement Controls */}
      <PlacementControls
        selectedPosition={selectedPosition}
        onPlace={handlePlacePixel}
        cooldownEnd={cooldownEnd}
        isPlacing={isPlacing}
        pixels={pixels.length}
        contributors={new Set(pixels.map(p => p.owner_id)).size}
      />

      {/* Pixel Info Modal */}
      <PixelModal
        pixel={selectedPixel}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        position={selectedPixel ? { x: selectedPixel.x, y: selectedPixel.y } : null}
      />

      {/* Toast Notification */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className={`fixed top-6 right-6 px-5 py-3.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl ${
            toast.type === 'success'
              ? 'bg-zinc-900 text-zinc-100'
              : 'bg-zinc-900 text-zinc-100'
          } font-medium text-sm z-50 max-w-sm`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

