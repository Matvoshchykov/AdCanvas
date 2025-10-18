'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PlacementControlsProps {
  selectedPosition: { x: number; y: number } | null;
  onPlace: (color: string, link: string) => Promise<void>;
  cooldownEnd: Date | null;
  isPlacing: boolean;
  pixels: number;
  contributors: number;
}

const PRESET_COLORS = [
  { color: '#DC2626', name: 'Red' },
  { color: '#EA580C', name: 'Orange' },
  { color: '#EAB308', name: 'Yellow' },
  { color: '#16A34A', name: 'Green' },
  { color: '#2563EB', name: 'Blue' },
  { color: '#7C3AED', name: 'Indigo' },
  { color: '#9333EA', name: 'Violet' },
  { color: '#FFFFFF', name: 'White' },
  { color: '#A3A3A3', name: 'Silver' },
  { color: '#737373', name: 'Gray' },
  { color: '#262626', name: 'Black' },
  { color: '#EC4899', name: 'Pink' },
  { color: '#F59E0B', name: 'Gold' },
  { color: '#06B6D4', name: 'Cyan' },
  { color: '#DB2777', name: 'Deep Pink' },
  { color: '#78350F', name: 'Brown' },
];

export default function PlacementControls({
  selectedPosition,
  onPlace,
  cooldownEnd,
  isPlacing,
  pixels,
  contributors,
}: PlacementControlsProps) {
  const [color, setColor] = useState('#DC2626');
  const [link, setLink] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Update time remaining
  useEffect(() => {
    if (!cooldownEnd) {
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = cooldownEnd.getTime();
      const remaining = Math.max(0, end - now);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [cooldownEnd]);

  const canPlace = timeRemaining === 0 && selectedPosition !== null && !isPlacing;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlace = async () => {
    if (!canPlace) return;
    await onPlace(color, link);
    setLink('');
    setShowSettings(false);
  };

  return (
    <>
      {/* Sticky Bottom Tab */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/40 backdrop-blur-md"
      >
        <div className="relative flex items-center justify-center px-6 py-4">
          {/* Center - Place Button (Half up the tab) */}
          <div className="absolute left-1/2 transform -translate-x-1/2" style={{ top: '-40px' }}>
            {/* Place Button - Contrasted Black */}
            <div className="relative">
              {/* Rotating green tracer around the button outline ONLY */}
              {selectedPosition && canPlace && (
                <div className="absolute inset-0 rounded-full pointer-events-none">
                  <motion.div
                    className="w-full h-full rounded-full"
                    style={{
                      background: 'conic-gradient(from 0deg, transparent 0deg, #10b981 60deg, transparent 120deg, transparent 360deg)',
                      padding: '2px',
                      mask: 'radial-gradient(circle, transparent calc(100% - 2px), black calc(100% - 1px))',
                      WebkitMask: 'radial-gradient(circle, transparent calc(100% - 2px), black calc(100% - 1px))',
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              )}
              
              <motion.button
                onClick={handlePlace}
                disabled={!canPlace}
                whileHover={canPlace ? { y: -2 } : {}}
                whileTap={canPlace ? { scale: 0.98 } : {}}
                className="relative px-10 py-3.5 rounded-full font-semibold text-lg tracking-wide transition-all duration-200 bg-orange-500 hover:bg-orange-600 text-white shadow-2xl hover:shadow-3xl z-10 disabled:bg-orange-500 disabled:opacity-100"
                style={{ backgroundColor: '#f97316' }}
              >
              {isPlacing ? (
                <span className="flex items-center gap-2.5">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Placing...</span>
                </span>
              ) : timeRemaining > 0 ? (
                <span className="flex items-center gap-2.5 font-mono text-xl">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span>{formatTime(timeRemaining)}</span>
                </span>
              ) : !selectedPosition ? (
                <span>Select a Cell</span>
              ) : (
                <span>Place Pixel</span>
              )}
            </motion.button>
            </div>
          </div>

          {/* Right side - Color + Settings */}
          <div className="absolute right-6 flex items-center gap-3" style={{ transform: 'translateY(-20px)' }}>
            {/* Color Circle with white outline */}
            <motion.button
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowSettings(false);
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-full shadow-lg transition-all duration-200 border-2 border-white"
              style={{ backgroundColor: color }}
            />

            {/* Settings Button */}
            <motion.button
              onClick={() => {
                setShowSettings(!showSettings);
                setShowColorPicker(false);
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl transition-all duration-200 ${
                showSettings 
                  ? 'bg-zinc-800/80' 
                  : 'bg-zinc-800/60 hover:bg-zinc-800/80 text-zinc-300 hover:text-white'
              }`}
            >
              <svg className={`w-6 h-6 ${showSettings ? 'text-orange-500 drop-shadow-[0_0_4px_rgba(249,115,22,0.8)]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span 
                className={`font-medium text-base ${showSettings ? 'drop-shadow-[0_0_4px_rgba(249,115,22,0.8)]' : ''}`}
                style={{ color: showSettings ? '#f97316' : undefined }}
              >
                Settings
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Color Picker Popup */}
      <AnimatePresence>
        {showColorPicker && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowColorPicker(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
            />

            {/* Popup - Above color circle at same height as other popups */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="fixed bottom-24 right-6 bg-zinc-900/95 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.8)] p-6 z-50 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-zinc-100 mb-4 text-center">Choose Color</h3>
              
              {/* Color Grid */}
              <div className="grid grid-cols-4 gap-3">
                {PRESET_COLORS.map((preset) => (
                  <motion.button
                    key={preset.color}
                    onClick={() => {
                      setColor(preset.color);
                      setShowColorPicker(false);
                    }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative w-6 h-6 rounded-full transition-all border-2 border-white ${
                      color === preset.color
                        ? 'ring-4 ring-zinc-700'
                        : ''
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  >
                    {color === preset.color && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Popup */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
            />

            {/* Popup */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              className="fixed bottom-24 right-6 bg-zinc-900/95 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.8)] p-6 z-50 min-w-[280px] backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-zinc-100 mb-5">Pixel Settings</h3>
              
              <div className="space-y-3">
                {/* Link Info */}
                <div className="bg-zinc-800/30 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 mb-2">
                    All pixels placed will display your desired product link.
                  </p>
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://your-link.com"
                    className="w-full bg-zinc-800 text-zinc-100 px-4 py-2.5 rounded-xl focus:outline-none transition-all placeholder:text-zinc-500"
                  />
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowSettings(false)}
                className="mt-5 w-full py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 rounded-xl transition-all duration-200 font-medium text-sm border border-zinc-700"
              >
                Close
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </>
  );
}

