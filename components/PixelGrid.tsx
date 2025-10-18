'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Database } from '@/lib/database.types';

type Pixel = Database['public']['Tables']['pixels']['Row'];

interface PixelGridProps {
  pixels: Pixel[];
  gridWidth: number;
  gridHeight: number;
  onPixelClick: (pixel: Pixel | null, x: number, y: number) => void;
  selectedPosition: { x: number; y: number } | null;
}

export default function PixelGrid({
  pixels,
  gridWidth,
  gridHeight,
  onPixelClick,
  selectedPosition,
}: PixelGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isZooming, setIsZooming] = useState(false);
  const lastWheelTime = useRef(0);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Create a map of pixels for faster lookup
  const pixelMap = useRef<Map<string, Pixel>>(new Map());

  // Initialize canvas position - zoomed out to see WHOLE map, CENTERED
  useEffect(() => {
    const initializeCanvas = () => {
      const container = containerRef.current;
      if (!container || !gridWidth || !gridHeight) return;
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const canvasWidth = gridWidth * 10;
      const canvasHeight = gridHeight * 10;
      
      // Force scale to fit entire canvas in view - ensure WHOLE map is visible
      const minScaleX = containerWidth / canvasWidth;
      const minScaleY = containerHeight / canvasHeight;
      const fitScale = Math.min(minScaleX, minScaleY) * 0.8; // 80% to guarantee whole map fits
      
      setScale(fitScale);
      
      // PERFECTLY CENTER the canvas with equal margins on all sides
      const scaledWidth = canvasWidth * fitScale;
      const scaledHeight = canvasHeight * fitScale;
      
      // Ensure canvas is centered with equal margins on ALL sides
      const centerX = (containerWidth - scaledWidth) / 2;
      const centerY = (containerHeight - scaledHeight) / 2;
      
      
      setOffset({ x: centerX, y: centerY });
    };

    // Try immediately first
    initializeCanvas();
    
    // Then with delays to ensure container is ready
    const timer1 = setTimeout(initializeCanvas, 50);
    const timer2 = setTimeout(initializeCanvas, 200);
    const timer3 = setTimeout(initializeCanvas, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [gridWidth, gridHeight]);

  useEffect(() => {
    // Update pixel map
    pixelMap.current.clear();
    for (const pixel of pixels) {
      pixelMap.current.set(`${pixel.x},${pixel.y}`, pixel);
    }
  }, [pixels]);

  // Smooth drawing function with requestAnimationFrame
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelSize = 10 * scale;
    const canvasWidth = gridWidth * pixelSize;
    const canvasHeight = gridHeight * pixelSize;

    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas with smooth rendering
    ctx.fillStyle = '#0e0e10';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid lines
    ctx.strokeStyle = '#1f1f22';
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let i = 0; i <= gridWidth; i++) {
      ctx.beginPath();
      ctx.moveTo(i * pixelSize, 0);
      ctx.lineTo(i * pixelSize, canvasHeight);
      ctx.stroke();
    }

    // Horizontal lines
    for (let i = 0; i <= gridHeight; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * pixelSize);
      ctx.lineTo(canvasWidth, i * pixelSize);
      ctx.stroke();
    }

    // Draw pixels
    for (const pixel of pixels) {
      ctx.fillStyle = pixel.color;
      ctx.fillRect(
        pixel.x * pixelSize + 1,
        pixel.y * pixelSize + 1,
        pixelSize - 2,
        pixelSize - 2
      );
    }

    // Draw selected position
    if (selectedPosition) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        selectedPosition.x * pixelSize + 1,
        selectedPosition.y * pixelSize + 1,
        pixelSize - 2,
        pixelSize - 2
      );
    }
  }, [pixels, gridWidth, gridHeight, scale, selectedPosition]);

  // Draw the grid with smooth updates
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      drawCanvas();
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawCanvas]);

  // Handle mouse wheel for zoom - ULTRA SMOOTH ZOOM AT MOUSE POSITION
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    // Throttle zoom updates for ultra smooth experience
    const now = Date.now();
    if (now - lastWheelTime.current < 16) return; // ~60fps limit
    lastWheelTime.current = now;

    // Faster zoom increments for responsive zooming
    const zoomFactor = Math.abs(e.deltaY) > 100 ? 
      (e.deltaY > 0 ? 0.94 : 1.06) : // Large wheel movements - faster
      (e.deltaY > 0 ? 0.97 : 1.03); // Small wheel movements - faster but smooth
    
    const newScale = Math.max(0.1, Math.min(10, scale * zoomFactor));
    
    // Get mouse position relative to container
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate the point under the mouse before zoom
    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;
    
    // Calculate new offset to keep the same point under the mouse after zoom
    const newOffsetX = mouseX - worldX * newScale;
    const newOffsetY = mouseY - worldY * newScale;
    
    setIsZooming(true);
    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
    
    // Reset zooming flag after a short delay with proper cleanup
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }
    zoomTimeoutRef.current = setTimeout(() => setIsZooming(false), 150);
  }, [scale, offset]);

  // Handle mouse down for dragging - only right click
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only allow dragging with right mouse button
    if (e.button === 2) { // Right mouse button
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }, [offset]);

  // Handle mouse move - FREE MOVEMENT, NO RESTRICTIONS
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        // Calculate new offset - completely free, no boundaries
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;

        setOffset({ x: newX, y: newY });
      }
    },
    [isDragging, dragStart]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle canvas click
  const [clickStartPos, setClickStartPos] = useState({ x: 0, y: 0 });
  
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setClickStartPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Only handle left click for pixel selection
      if (e.button !== 0) return; // Left mouse button only
      
      // Only register click if mouse hasn't moved much (not a drag)
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - clickStartPos.x, 2) + 
        Math.pow(e.clientY - clickStartPos.y, 2)
      );
      
      if (dragDistance > 5) return; // Was a drag, not a click
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const pixelSize = 10 * scale;
      
      const x = Math.floor((e.clientX - rect.left) / pixelSize);
      const y = Math.floor((e.clientY - rect.top) / pixelSize);

      if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        const pixel = pixelMap.current.get(`${x},${y}`) || null;
        onPixelClick(pixel, x, y);
      }
    },
    [gridWidth, gridHeight, scale, onPixelClick, clickStartPos]
  );

  // Add wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden bg-zinc-950"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
      >
      <motion.div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          willChange: isZooming ? 'transform' : 'auto',
        }}
        animate={{
          x: offset.x,
          y: offset.y,
        }}
        transition={isZooming ? {
          type: 'tween',
          duration: 0,
          ease: 'linear'
        } : {
          type: 'spring', 
          stiffness: 500, 
          damping: 35,
          mass: 0.2
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onClick={handleCanvasClick}
          className="shadow-2xl"
        />
      </motion.div>

      {/* Zoom controls */}
      <div className="absolute top-6 right-6 flex gap-2">
        <button
          onClick={() => {
            const newScale = Math.min(10, scale * 1.2);
            setScale(newScale);
          }}
          className="w-11 h-11 bg-zinc-800/90 hover:bg-zinc-750 backdrop-blur-sm text-zinc-300 hover:text-zinc-100 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => {
            const newScale = Math.max(0.1, scale / 1.2);
            setScale(newScale);
          }}
          className="w-11 h-11 bg-zinc-800/90 hover:bg-zinc-750 backdrop-blur-sm text-zinc-300 hover:text-zinc-100 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={() => {
            const container = containerRef.current;
            if (!container) return;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const canvasWidth = gridWidth * 10;
            const canvasHeight = gridHeight * 10;
            
            if (selectedPosition) {
              // Center on selected pixel at current scale
              const pixelSize = 10 * scale;
              const pixelCenterX = selectedPosition.x * pixelSize + pixelSize / 2;
              const pixelCenterY = selectedPosition.y * pixelSize + pixelSize / 2;
              
              setOffset({
                x: containerWidth / 2 - pixelCenterX,
                y: containerHeight / 2 - pixelCenterY,
              });
            } else {
              // No selected pixel - reset to fit full view
              const minScaleX = containerWidth / canvasWidth;
              const minScaleY = containerHeight / canvasHeight;
              const fitScale = Math.min(minScaleX, minScaleY) * 0.9;
              
              setScale(fitScale);
              
              const scaledWidth = canvasWidth * fitScale;
              const scaledHeight = canvasHeight * fitScale;
              setOffset({ 
                x: (containerWidth - scaledWidth) / 2, 
                y: (containerHeight - scaledHeight) / 2 
              });
            }
          }}
          className="w-11 h-11 bg-zinc-800/90 hover:bg-zinc-750 backdrop-blur-sm text-zinc-300 hover:text-zinc-100 rounded-xl text-base transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          aria-label="Reset view"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}

