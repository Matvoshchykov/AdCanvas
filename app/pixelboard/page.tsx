'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [isColorMatchActive, setIsColorMatchActive] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [onboardingUrl, setOnboardingUrl] = useState('');
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [hasPlacedPixel, setHasPlacedPixel] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  // Get current user ID (use Whop user or fallback to mock)
  const userId = user?.id || `mock_user_${typeof window !== 'undefined' ? localStorage.getItem('mockUserId') || Math.random().toString(36).substring(7) : 'dev'}`;
  // Prioritize actual username from Whop user object
  const userName = user?.username || user?.name || user?.displayName || user?.email?.split('@')[0] || `User_${userId.slice(-6)}`;

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

  // Check if user needs onboarding - always show on reload
  useEffect(() => {
    if (!isLoading && !userLoading && isSupabaseConfigured) {
      setShowOnboarding(true);
      setCurrentSlide(0); // Reset to first slide
      setOnboardingUrl(''); // Reset URL input
    }
  }, [isLoading, userLoading, isSupabaseConfigured]);

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

  // Check if user has placed pixels before
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      setHasPlacedPixel(false);
      return;
    }

    const userHasPixels = pixels.some(pixel => pixel.owner_id === userId);
    setHasPlacedPixel(userHasPixels);
  }, [userId, pixels, isSupabaseConfigured]);

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
      if (isColorMatchActive) {
        // Color match mode - just set the pixel for color copying, don't show modal
        setSelectedPixel(pixel);
        setIsModalOpen(false);
        setSelectedPosition(null);
      } else {
        // Normal mode - show info modal
        setSelectedPixel(pixel);
        setIsModalOpen(true);
        setSelectedPosition(null);
      }
    } else {
      // Empty space clicked - select for placement
      setSelectedPosition({ x, y });
      setIsModalOpen(false);
    }
  }, [isColorMatchActive]);

  // Handle color match active state change
  const handleColorMatchActiveChange = useCallback((isActive: boolean) => {
    setIsColorMatchActive(isActive);
  }, []);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Handle pixel placement
  const handlePlacePixel = useCallback(async (color: string, link: string) => {
    if (!selectedPosition || isPlacing) return;

    // Show first-time modal if user hasn't placed pixels before
    if (!hasPlacedPixel) {
      setShowFirstTimeModal(true);
      return;
    }

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
        setHasPlacedPixel(true); // Mark that user has now placed a pixel
        
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
  }, [selectedPosition, isPlacing, hasPlacedPixel, userId, userName, showToast]);

  // Complete onboarding
  const completeOnboarding = () => {
    // Store the URL if provided
    if (onboardingUrl.trim()) {
      // You can store this in localStorage or pass it to the placement controls
      localStorage.setItem('pixelboard-default-url', onboardingUrl.trim());
    }
    
    localStorage.setItem('pixelboard-onboarding-completed', 'true');
    setShowOnboarding(false);
    setCurrentSlide(0);
    setOnboardingUrl('');
    setOnboardingCompleted(true);
  };

  // Navigate to next slide
  const nextSlide = () => {
    setCurrentSlide(prev => prev + 1);
  };

  // Navigate to previous slide
  const prevSlide = () => {
    setCurrentSlide(prev => prev - 1);
  };

  // Skip onboarding (only allowed on last slide)
  const skipOnboarding = () => {
    if (currentSlide === 6) { // Last slide is index 6 (URL input)
      completeOnboarding();
    }
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
        selectedPixel={selectedPixel}
        onPlace={handlePlacePixel}
        onColorMatchActiveChange={handleColorMatchActiveChange}
        cooldownEnd={cooldownEnd}
        isPlacing={isPlacing}
        pixels={pixels.length}
        contributors={new Set(pixels.map(p => p.owner_id)).size}
        pixelData={pixels}
        onboardingCompleted={onboardingCompleted}
        userId={userId}
      />

      {/* Onboarding Slideshow Modal */}
      <AnimatePresence>
        {showOnboarding && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 max-w-[90vw] h-[36rem] max-h-[90vh] rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.8)] p-6 z-50 overflow-hidden ${
              theme === 'dark' ? 'bg-zinc-900/95' : 'bg-white/95'
            } backdrop-blur-xl flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress Bar */}
            <div className="w-full bg-gray-200/20 rounded-full h-2 mb-6">
              <motion.div
                className="bg-orange-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentSlide + 1) / 7) * 100}%` }}
                transition={{ duration: 0.3 }}
                style={{ backgroundColor: '#f97316' }}
              />
            </div>

            {/* Slide Content */}
            <div className="flex-1 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {currentSlide === 0 && (
                  <motion.div
                    key="slide-1"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="text-center max-w-sm mx-auto"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                      🎨
                    </div>
                    <h1 className={`text-2xl font-bold mb-3 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Welcome to PixelBoard!
                    </h1>
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-zinc-400' : 'text-gray-600'
                    }`}>
                      Create collaborative pixel art and <strong>promote your products</strong> with your creativity!
                    </p>
                  </motion.div>
                )}

                {currentSlide === 1 && (
                  <motion.div
                    key="slide-2"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="text-center max-w-sm mx-auto"
                  >
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                      1
                    </div>
                    <h2 className={`text-xl font-bold mb-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Select a Cell
                    </h2>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'
                    }`}>
                      Click on any empty cell to select it for pixel placement.
                    </p>
                  </motion.div>
                )}

                {currentSlide === 2 && (
                  <motion.div
                    key="slide-3"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="text-center max-w-sm mx-auto"
                  >
                    <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                      2
                    </div>
                    <h2 className={`text-xl font-bold mb-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Choose Your Color
                    </h2>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'
                    }`}>
                      Use the color slider on the right side to pick your perfect color.
                    </p>
                  </motion.div>
                )}

                {currentSlide === 3 && (
                  <motion.div
                    key="slide-4"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="text-center max-w-sm mx-auto"
                  >
                    <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center text-white mx-auto mb-3">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l10.71-10.71 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42zM6.92 19L5 17.08l8.71-8.71 1.92 1.92L6.92 19z"/>
                      </svg>
                    </div>
                    <h2 className={`text-xl font-bold mb-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Color Matching Tool
                    </h2>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'
                    }`}>
                      Click the pipette icon to copy colors from existing pixels to your slider.
                    </p>
                  </motion.div>
                )}

                {currentSlide === 4 && (
                  <motion.div
                    key="slide-5"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="text-center max-w-sm mx-auto"
                  >
                    <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                      4
                    </div>
                    <h2 className={`text-xl font-bold mb-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Place Your Pixel
                    </h2>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'
                    }`}>
                      Click "Place Pixel" to add your pixel to the canvas. <strong>Pixels cannot be erased!</strong> Use your creativity to promote your products and create something amazing.
                    </p>
                  </motion.div>
                )}

                {currentSlide === 5 && (
                  <motion.div
                    key="slide-6"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="text-center max-w-sm mx-auto"
                  >
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white mx-auto mb-3">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <h2 className={`text-xl font-bold mb-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Your Creative Canvas
                    </h2>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'
                    }`}>
                      <strong>This is your space to showcase creativity and promote your products!</strong> Each pixel tells your story and drives traffic to what you offer.
                    </p>
                  </motion.div>
                )}

                {currentSlide === 6 && (
                  <motion.div
                    key="slide-7"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="text-center max-w-sm mx-auto w-full"
                  >
                    <div className="w-12 h-12 bg-pink-500 rounded-xl flex items-center justify-center text-white mx-auto mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <h2 className={`text-xl font-bold mb-3 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Promote Your Products
                    </h2>
                    <p className={`text-xs mb-4 ${
                      theme === 'dark' ? 'text-zinc-300' : 'text-gray-600'
                    }`}>
                      <strong>Use your creativity to promote your products!</strong> When others click on your pixels, they'll see your product link and discover what you have to offer.
                    </p>
                    <div className="mx-auto">
                      <input
                        type="url"
                        value={onboardingUrl}
                        onChange={(e) => setOnboardingUrl(e.target.value)}
                        placeholder="https://your-product-link.com"
                        className={`w-full px-3 py-2 rounded-lg text-center text-sm focus:outline-none transition-all ${
                          theme === 'dark' 
                            ? 'bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 border border-zinc-700 focus:border-orange-500'
                            : 'bg-white text-gray-900 placeholder:text-gray-500 border border-gray-300 focus:border-orange-500'
                        }`}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-auto pt-4">
              <div className="flex items-center">
                <motion.button
                  onClick={prevSlide}
                  disabled={currentSlide === 0}
                  whileHover={currentSlide > 0 ? { scale: 1.05 } : {}}
                  whileTap={currentSlide > 0 ? { scale: 0.95 } : {}}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                    currentSlide === 0
                      ? theme === 'dark'
                        ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : theme === 'dark'
                        ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Previous
                </motion.button>
              </div>


              <div className="flex gap-2">
                {currentSlide === 6 && (
                  <motion.button
                    onClick={skipOnboarding}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                      theme === 'dark'
                        ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    Skip
                  </motion.button>
                )}
                
                <motion.button
                  onClick={currentSlide === 6 ? completeOnboarding : nextSlide}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-2 rounded-lg font-semibold transition-all duration-200 text-sm bg-orange-500 hover:bg-orange-600 text-white"
                  style={{ backgroundColor: '#f97316' }}
                >
                  {currentSlide === 6 ? 'Continue' : 'Next'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
        )}
      </AnimatePresence>

      {/* First Time Placement Modal */}
      <AnimatePresence>
        {showFirstTimeModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFirstTimeModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className={`fixed inset-16 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.8)] p-8 z-50 flex flex-col items-center justify-center ${
                theme === 'dark' ? 'bg-zinc-900/95' : 'bg-white/95'
              } backdrop-blur-xl relative`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowFirstTimeModal(false)}
                className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200/20 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Content */}
              <div className="text-center max-w-md">
                <h2 className={`text-3xl font-bold mb-6 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Create indefinitely with no cooldown
                </h2>
                
                <motion.button
                  onClick={() => setShowFirstTimeModal(false)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 bg-green-500 hover:bg-green-600 text-white shadow-lg"
                  style={{ 
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
                  }}
                >
                  Get Access
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

