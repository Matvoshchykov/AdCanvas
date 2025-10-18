'use client';

import { useState, useEffect } from 'react';
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
    <div className="flex items-center gap-4 flex-1 flex-wrap">
      {/* Selected Position */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Position:</span>
        {selectedPosition ? (
          <div className="flex items-center gap-1 text-sm font-mono bg-gray-900 px-3 py-1 rounded">
            <span className="text-blue-400">{selectedPosition.x}</span>
            <span className="text-gray-600">,</span>
            <span className="text-green-400">{selectedPosition.y}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-500 italic">Click on canvas</span>
        )}
      </div>

      {/* Color Picker - Compact */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Color:</span>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-10 h-10 rounded border-2 border-gray-700 hover:border-white transition-colors"
            style={{ backgroundColor: color }}
            title={color}
          />
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-24 bg-gray-900 text-white px-2 py-1 rounded text-sm border border-gray-700 focus:border-blue-500 focus:outline-none font-mono"
            placeholder="#FF0000"
          />
        </div>

        {/* Floating Color Picker */}
        {showColorPicker && (
          <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1d] border border-gray-800 rounded-lg p-4 shadow-2xl z-50">
            <div className="mb-3">
              <HexColorPicker color={color} onChange={setColor} style={{ width: '200px', height: '150px' }} />
            </div>
            <div className="grid grid-cols-7 gap-1">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  onClick={() => {
                    setColor(presetColor);
                    setShowColorPicker(false);
                  }}
                  className={`w-6 h-6 rounded border transition-all hover:scale-110 ${
                    color === presetColor ? 'border-white' : 'border-gray-700'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  title={presetColor}
                />
              ))}
            </div>
            <button
              onClick={() => setShowColorPicker(false)}
              className="mt-3 w-full px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Link Input */}
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <span className="text-sm text-gray-400">Link:</span>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://your-link.com (optional)"
          className="flex-1 bg-gray-900 text-white px-3 py-1 rounded text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Place Button */}
      <button
        onClick={handlePlace}
        disabled={!canPlace}
        className={`px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap ${
          canPlace
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isPlacing ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Placing...
          </span>
        ) : timeRemaining > 0 ? (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {formatTime(timeRemaining)}
          </span>
        ) : !selectedPosition ? (
          'Select Position'
        ) : (
          'Place Pixel'
        )}
      </button>
    </div>
  );
}

