'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@/lib/database.types';

type Pixel = Database['public']['Tables']['pixels']['Row'];

interface PixelModalProps {
  pixel: Pixel | null;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number } | null;
}

export default function PixelModal({ pixel, isOpen, onClose, position }: PixelModalProps) {
  if (!isOpen || !pixel) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className="bg-zinc-900/95 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.8)] max-w-md w-full overflow-hidden backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with color preview */}
          <div className="relative h-20 flex items-center justify-center bg-zinc-800/30">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 25 }}
              className="w-14 h-14 rounded-xl shadow-lg"
              style={{ backgroundColor: pixel.color }}
            />
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-medium text-zinc-500 mb-1">Position</h3>
                <p className="text-base font-semibold text-zinc-100 font-mono">
                  {pixel.x}, {pixel.y}
                </p>
              </div>
              <div className="text-right">
                <h3 className="text-xs font-medium text-zinc-500 mb-1">Placed</h3>
                <p className="text-sm text-zinc-300">
                  {formatDistanceToNow(new Date(pixel.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <h3 className="text-xs font-medium text-zinc-500 mb-2">Owner</h3>
              <p className="text-base text-zinc-100 font-medium">
                {pixel.owner_name || `User ${pixel.owner_id.slice(0, 8)}...`}
              </p>
            </div>

            {pixel.link && (
              <div className="pt-4 border-t border-zinc-800">
                <a
                  href={pixel.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  <span>Visit Link</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}
          </div>

          {/* Close button */}
          <div className="border-t border-zinc-800 p-4">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 rounded-xl transition-all duration-200 font-medium text-sm"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

