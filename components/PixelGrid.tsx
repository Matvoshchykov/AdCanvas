'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Database } from '@/lib/database.types';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { theme } = useTheme();
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
  
  // Mobile touch state
  const [touches, setTouches] = useState<React.TouchList | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  
  // Create a map of pixels for faster lookup
  const pixelMap = useRef<Map<string, Pixel>>(new Map());

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize canvas position - different behavior for mobile vs desktop
  useEffect(() => {
    const initializeCanvas = () => {
      const container = containerRef.current;
      if (!container || !gridWidth || !gridHeight) return;
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const canvasWidth = gridWidth * 10;
      const canvasHeight = gridHeight * 10;
      
      if (isMobile) {
        // Mobile: Start zoomed in to fill screen
        const maxScaleX = containerWidth / canvasWidth;
        const maxScaleY = containerHeight / canvasHeight;
        const zoomedScale = Math.max(maxScaleX, maxScaleY) * 1.2; // Zoomed in with some margin
        
        setScale(zoomedScale);
        
        // Center the canvas when zoomed in
        const scaledWidth = canvasWidth * zoomedScale;
        const scaledHeight = canvasHeight * zoomedScale;
        const centerX = (containerWidth - scaledWidth) / 2;
        const centerY = (containerHeight - scaledHeight) / 2;
        
        setOffset({ x: centerX, y: centerY });
      } else {
        // Desktop: Start zoomed out to see whole map
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
      }
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
  }, [gridWidth, gridHeight, isMobile]);

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

    // Clear canvas with smooth rendering - theme aware
    ctx.fillStyle = theme === 'dark' ? '#0e0e10' : '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid lines - theme aware
    ctx.strokeStyle = theme === 'dark' ? '#1f1f22' : '#e5e5e5';
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

    // Draw selected position - theme aware
    if (selectedPosition) {
      ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        selectedPosition.x * pixelSize + 1,
        selectedPosition.y * pixelSize + 1,
        pixelSize - 2,
        pixelSize - 2
      );
    }
  }, [pixels, gridWidth, gridHeight, scale, selectedPosition, theme]);

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

  // Mobile touch handlers
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length !== 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList, container: HTMLElement) => {
    if (touches.length === 0) return { x: 0, y: 0 };
    if (touches.length === 1) {
      const rect = container.getBoundingClientRect();
      return { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top };
    }
    const rect = container.getBoundingClientRect();
    const x = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
    const y = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
    return { x, y };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    setTouches(e.touches);
    
    if (e.touches.length === 1) {
      // Single touch - start dragging
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      setIsDragging(true);
      setDragStart({ x: touch.clientX - rect.left - offset.x, y: touch.clientY - rect.top - offset.y });
    } else if (e.touches.length === 2) {
      // Two touches - prepare for pinch zoom
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches, container);
      setLastTouchDistance(distance);
      setLastTouchCenter(center);
      setIsZooming(true);
      setIsDragging(false);
    }
  }, [offset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    if (e.touches.length === 1 && isDragging) {
      // Single touch drag
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const newX = touch.clientX - rect.left - dragStart.x;
      const newY = touch.clientY - rect.top - dragStart.y;
      setOffset({ x: newX, y: newY });
    } else if (e.touches.length === 2) {
      // Two finger pinch zoom
      const distance = getTouchDistance(e.touches);
      const center = getTouchCenter(e.touches, container);
      
      if (lastTouchDistance > 0) {
        const scaleFactor = distance / lastTouchDistance;
        const newScale = Math.max(0.1, Math.min(10, scale * scaleFactor));
        
        // Calculate the point under the center of touches before zoom
        const worldX = (center.x - offset.x) / scale;
        const worldY = (center.y - offset.y) / scale;
        
        // Calculate new offset to keep the same point under the touches after zoom
        const newOffsetX = center.x - worldX * newScale;
        const newOffsetY = center.y - worldY * newScale;
        
        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
      }
      
      setLastTouchDistance(distance);
      setLastTouchCenter(center);
    }
  }, [scale, offset, isDragging, dragStart, lastTouchDistance]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    setIsDragging(false);
    setIsZooming(false);
    setTouches(null);
    setLastTouchDistance(0);
  }, []);

  const handleCanvasTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    // Only handle single touch for pixel selection
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setClickStartPos({ x: touch.clientX, y: touch.clientY });
    }
  }, []);

  const handleCanvasTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    // Only handle single touch end for pixel selection
    if (e.changedTouches.length === 1 && !isDragging) {
      const touch = e.changedTouches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Only register tap if touch hasn't moved much (not a drag)
      const dragDistance = Math.sqrt(
        Math.pow(touch.clientX - clickStartPos.x, 2) + 
        Math.pow(touch.clientY - clickStartPos.y, 2)
      );
      
      if (dragDistance > 10) return; // Was a drag, not a tap
      
      const rect = canvas.getBoundingClientRect();
      const pixelSize = 10 * scale;
      
      const x = Math.floor((touch.clientX - rect.left) / pixelSize);
      const y = Math.floor((touch.clientY - rect.top) / pixelSize);

      if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
        const pixel = pixelMap.current.get(`${x},${y}`) || null;
        onPixelClick(pixel, x, y);
      }
    }
  }, [gridWidth, gridHeight, scale, onPixelClick, clickStartPos, isDragging]);

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
        className={`relative w-full h-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-50'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: isDragging ? 'grabbing' : 'crosshair', touchAction: 'none' }}
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
          onTouchStart={handleCanvasTouchStart}
          onTouchEnd={handleCanvasTouchEnd}
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

