'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HexColorPicker } from 'react-colorful';

interface PlacementPanelProps {
  selectedPosition: { x: number; y: number } | null;
  onPlace: (color: string, link: string) => Promise<void>;
  cooldownEnd: Date | null;
  isPlacing: boolean;
}

const PRESET_COLORS = [
  '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3',
  '#FFFFFF', '#C0C0C0', '#808080', '#000000', '#FFC0CB', '#FFD700', '#00FFFF',
];

export default function PlacementPanel({
  selectedPosition,
  onPlace,
  cooldownEnd,
  isPlacing,
}: PlacementPanelProps) {
  const [color, setColor] = useState('#FF0000');
  const [link, setLink] = useState('');
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
    setLink(''); // Clear link after placement
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="bg-[#1a1a1d] border border-gray-800 rounded-xl shadow-2xl p-6"
    >
      <h2 className="text-2xl font-bold text-white mb-4">Place Your Pixel</h2>

      {/* Selected Position */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Selected Position
        </label>
        {selectedPosition ? (
          <div className="flex items-center gap-2 text-white text-lg font-mono bg-gray-900 px-4 py-2 rounded-lg">
            <span className="text-blue-400">X:</span> {selectedPosition.x}
            <span className="text-gray-600">|</span>
            <span className="text-green-400">Y:</span> {selectedPosition.y}
          </div>
        ) : (
          <div className="text-gray-500 italic bg-gray-900 px-4 py-2 rounded-lg">
            Click on the grid to select a position
          </div>
        )}
      </div>

      {/* Color Picker */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Pixel Color
        </label>
        
        {/* Preset colors */}
        <div className="grid grid-cols-7 gap-2 mb-3">
          {PRESET_COLORS.map((presetColor) => (
            <button
              key={presetColor}
              onClick={() => setColor(presetColor)}
              className={`w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 ${
                color === presetColor ? 'border-white scale-110' : 'border-gray-700'
              }`}
              style={{ backgroundColor: presetColor }}
              title={presetColor}
            />
          ))}
        </div>

        {/* Current color display and custom picker toggle */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg border-2 border-gray-700 shadow-md"
            style={{ backgroundColor: color }}
          />
          <div className="flex-1">
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none font-mono"
              placeholder="#FF0000"
            />
          </div>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
          >
            {showColorPicker ? 'Hide' : 'Custom'}
          </button>
        </div>

        {/* Custom color picker */}
        {showColorPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 overflow-hidden"
          >
            <HexColorPicker color={color} onChange={setColor} className="w-full" />
          </motion.div>
        )}
      </div>

      {/* Link Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Link (Optional)
        </label>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://your-link.com"
          className="w-full bg-gray-900 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
        />
        <p className="text-xs text-gray-500 mt-1">
          Add a link to promote your community or product
        </p>
      </div>

      {/* Place Button */}
      <button
        onClick={handlePlace}
        disabled={!canPlace}
        className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition-all ${
          canPlace
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isPlacing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Placing...
          </span>
        ) : timeRemaining > 0 ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Cooldown: {formatTime(timeRemaining)}
          </span>
        ) : !selectedPosition ? (
          'Select a Position'
        ) : (
          'Place Pixel'
        )}
      </button>

      {/* Info */}
      <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-800">
        <p className="text-xs text-gray-400">
          ℹ️ You can place <span className="text-white font-semibold">1 pixel every 10 minutes</span>. 
          Once placed, pixels are <span className="text-white font-semibold">permanent</span> and cannot be changed.
        </p>
      </div>
    </motion.div>
  );
}

