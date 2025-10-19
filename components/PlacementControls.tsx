'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';


type Pixel = {
  x: number;
  y: number;
  color: string;
  owner_id: string;
  owner_name: string | null;
};

interface PlacementControlsProps {
  selectedPosition: { x: number; y: number } | null;
  selectedPixel: Pixel | null;
  onPlace: (color: string, link: string) => Promise<void>;
  onColorMatchActiveChange?: (isActive: boolean) => void;
  cooldownEnd: Date | null;
  isPlacing: boolean;
  pixels: number;
  contributors: number;
  pixelData: Pixel[];
  onboardingCompleted?: boolean;
  userId?: string;
  userLoading?: boolean;
}

// Generate color spectrum for the slider
const generateColorSpectrum = () => {
  const colors = [];
  // Generate smooth color transitions across the spectrum
  // Create a more vibrant spectrum with better distribution
  for (let i = 0; i <= 360; i += 1) {
    const hue = i;
    // Use different saturations and lightness for better visual effect
    let saturation = 100;
    let lightness = 50;
    
    // Adjust for certain ranges to make colors more vibrant
    if (i >= 0 && i <= 60) { // Red to Yellow range
      saturation = 100;
      lightness = 50;
    } else if (i >= 60 && i <= 120) { // Yellow to Green range
      saturation = 100;
      lightness = 45;
    } else if (i >= 120 && i <= 180) { // Green to Cyan range
      saturation = 90;
      lightness = 45;
    } else if (i >= 180 && i <= 240) { // Cyan to Blue range
      saturation = 100;
      lightness = 55;
    } else if (i >= 240 && i <= 300) { // Blue to Magenta range
      saturation = 100;
      lightness = 50;
    } else { // Magenta to Red range
      saturation = 100;
      lightness = 50;
    }
    
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  return colors;
};

const COLOR_SPECTRUM = generateColorSpectrum();

// Convert HSL to hex for better compatibility
const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// Safe hook wrapper for accessing Whop iframe SDK - completely avoids problematic imports
function useIframeSdk() {
  const [iframeSdk, setIframeSdk] = useState<any>(null);

  useEffect(() => {
    // Completely avoid importing from @whop/react to prevent build issues
    // Instead, rely on the SDK being available through the WhopApp context
    const loadIframeSdk = () => {
      try {
        // Check if we're in the browser
        if (typeof window === 'undefined') {
          return;
        }

        // Try to access the iframe SDK through the WhopApp context
        // This should be available when running within a Whop app
        const possibleSDKs = [
          (window as any).whop,
          (window as any).Whop,
          (window as any).whopIframeSDK,
        ];

        // Also check parent window if we're in an iframe
        if (window.parent !== window) {
          possibleSDKs.push(
            (window.parent as any)?.whop,
            (window.parent as any)?.Whop,
          );
        }

        for (const sdk of possibleSDKs) {
          if (sdk && sdk.inAppPurchase && typeof sdk.inAppPurchase === 'function') {
            console.log('Found iframe SDK in context');
            setIframeSdk(sdk);
            return;
          }
        }

        console.log('iframe SDK not available - this is expected in development');
      } catch (error) {
        console.log('Failed to access iframe SDK:', error);
      }
    };

    // Use a small delay to ensure the WhopApp context is ready
    const timer = setTimeout(loadIframeSdk, 100);
    return () => clearTimeout(timer);
  }, []);

  return iframeSdk;
}

// Iframe detection hook (same as in main page)
function useIframeDetection() {
  const [isInsideWhop, setIsInsideWhop] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkIframeContext = () => {
      try {
        const inIframe = window !== window.top;
        let inWhopIframe = false;
        
        if (inIframe) {
          try {
            const parentOrigin = window.parent.location.origin;
            inWhopIframe = parentOrigin.includes('whop.com');
          } catch {
            inWhopIframe = true;
          }
          
          if (document.referrer && document.referrer.includes('whop.com')) {
            inWhopIframe = true;
          }
        }

        setIsInsideWhop(inWhopIframe);
        setIsLoading(false);
      } catch (error) {
        console.error('Error detecting iframe context:', error);
        setIsInsideWhop(false);
        setIsLoading(false);
      }
    };

    checkIframeContext();
  }, []);

  return { isInsideWhop, isLoading };
}

export default function PlacementControls({
  selectedPosition,
  selectedPixel,
  onPlace,
  onColorMatchActiveChange,
  cooldownEnd,
  isPlacing,
  pixels,
  contributors,
  pixelData,
  onboardingCompleted,
  userId,
  userLoading = false,
}: PlacementControlsProps) {
  const { theme } = useTheme();
  
  // Use the proper iframe SDK hook as per official docs
  const iframeSdk = useIframeSdk();
  const { isInsideWhop } = useIframeDetection();
  const [color, setColor] = useState('#DC2626');
  const [link, setLink] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isMobile, setIsMobile] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(0.5); // 0-1 range for slider
  const [isColorMatchActive, setIsColorMatchActive] = useState(false); // Color match tool toggle
  const sliderRef = useRef<HTMLDivElement>(null);


  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load default URL from onboarding
  useEffect(() => {
    const defaultUrl = localStorage.getItem('pixelboard-default-url');
    if (defaultUrl) {
      setLink(defaultUrl);
    }
  }, []);

  // Reload default URL when onboarding completes
  useEffect(() => {
    if (onboardingCompleted) {
      const defaultUrl = localStorage.getItem('pixelboard-default-url');
      if (defaultUrl) {
        setLink(defaultUrl);
      }
    }
  }, [onboardingCompleted]);

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

  // Function to get pixel color at a specific position
  const getPixelColorAt = (x: number, y: number): string | null => {
    const pixel = pixelData.find(p => p.x === x && p.y === y);
    return pixel ? pixel.color : null;
  };

  // Update color based on slider position
  useEffect(() => {
    // The slider position is inverted from the visual gradient
    // sliderPosition 0 = bottom (violet), sliderPosition 1 = top (red)
    // But the gradient shows: top = red (index 0), bottom = violet (index max)
    // So we need to invert the sliderPosition to get the correct color index
    const visualPosition = 1 - sliderPosition;
    const colorIndex = Math.floor(visualPosition * (COLOR_SPECTRUM.length - 1));
    const hslColor = COLOR_SPECTRUM[colorIndex];
    if (hslColor) {
      // Parse HSL and convert to hex
      const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (match) {
        const h = parseInt(match[1]);
        const s = parseInt(match[2]);
        const l = parseInt(match[3]);
        const hexColor = hslToHex(h, s, l);
        setColor(hexColor);
      }
    }
  }, [sliderPosition]);

  // Find closest color in spectrum and return its position
  const findColorInSpectrum = (targetHex: string) => {
    let closestIndex = 0;
    let minDistance = Infinity;
    
    // Convert target hex to RGB
    const r = parseInt(targetHex.slice(1, 3), 16);
    const g = parseInt(targetHex.slice(3, 5), 16);
    const b = parseInt(targetHex.slice(5, 7), 16);
    
    // Compare with all colors in spectrum
    for (let i = 0; i < COLOR_SPECTRUM.length; i++) {
      const hslColor = COLOR_SPECTRUM[i];
      const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (match) {
        const h = parseInt(match[1]);
        const s = parseInt(match[2]);
        const l = parseInt(match[3]);
        const spectrumHex = hslToHex(h, s, l);
        
        // Convert spectrum hex to RGB
        const sr = parseInt(spectrumHex.slice(1, 3), 16);
        const sg = parseInt(spectrumHex.slice(3, 5), 16);
        const sb = parseInt(spectrumHex.slice(5, 7), 16);
        
        // Calculate Euclidean distance
        const distance = Math.sqrt(Math.pow(r - sr, 2) + Math.pow(g - sg, 2) + Math.pow(b - sb, 2));
        
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
    }
    
    // Convert index to slider position (remember it's inverted)
    return 1 - (closestIndex / (COLOR_SPECTRUM.length - 1));
  };

  // Auto-copy color when a pixel is selected AND color match tool is active
  useEffect(() => {
    if (selectedPixel && isColorMatchActive) {
      const pixelColor = selectedPixel.color;
      if (pixelColor) {
        setColor(pixelColor);
        // Update slider position based on the matched color
        const newPosition = findColorInSpectrum(pixelColor);
        setSliderPosition(newPosition);
      }
    }
  }, [selectedPixel, isColorMatchActive]);

  // Notify parent when color match state changes
  useEffect(() => {
    onColorMatchActiveChange?.(isColorMatchActive);
  }, [isColorMatchActive, onColorMatchActiveChange]);

  // Handle slider input
  const handleSliderChange = (position: number) => {
    setSliderPosition(Math.max(0, Math.min(1, position)));
  };

  // Get the exact color at slider position for the indicator
  const getSliderColorAtPosition = (position: number) => {
    const colorIndex = Math.floor(position * (COLOR_SPECTRUM.length - 1));
    const hslColor = COLOR_SPECTRUM[colorIndex];
    if (hslColor) {
      const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (match) {
        const h = parseInt(match[1]);
        const s = parseInt(match[2]);
        const l = parseInt(match[3]);
        return hslToHex(h, s, l);
      }
    }
    return color; // fallback to current color
  };

  // Convert hex to HSL for better slider positioning
  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    
    if (max !== min) {
      if (max === r) h = ((g - b) / (max - min)) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
    }
    
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    
    return h;
  };

  // Set initial slider position based on default color
  useEffect(() => {
    const defaultColor = '#DC2626'; // Red color
    const hue = hexToHsl(defaultColor);
    const newPosition = hue / 360;
    setSliderPosition(newPosition);
  }, []);

  // Color matching tool toggle function
  const handleColorMatch = () => {
    setIsColorMatchActive(!isColorMatchActive);
  };

  const handlePlace = async () => {
    if (!canPlace) return;
    await onPlace(color, link);
    setLink('');
    setShowSettings(false);
  };

  // Handle checkout creation for no cooldown button - using official docs pattern
  const handleCheckout = async () => {
    console.log('Checkout clicked - userId:', userId, 'userLoading:', userLoading);
    
    // Simple check: if still loading, wait
    if (userLoading) {
      alert('Please wait while we authenticate with Whop...');
      return;
    }

    // If no user ID at all, that's a problem
    if (!userId) {
      alert('User authentication required. Please ensure you are logged into Whop.');
      return;
    }

    try {
      console.log('Starting checkout process for user:', userId);
      
      // 1. Create charge on server (according to official docs)
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
      });

      // Read the response once
      const responseText = await response.text();
      console.log('Raw API response:', responseText);
      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        console.error('Charge creation failed - Response not OK:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          responseText: responseText
        });
        
        let errorData;
        try {
          if (responseText && responseText.trim()) {
            errorData = JSON.parse(responseText);
          } else {
            errorData = { error: `Server error (${response.status}): No response body` };
          }
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          errorData = { error: `Server error (${response.status}): ${responseText || 'No response body'}` };
        }
        
        console.error('Parsed error data:', errorData);
        
        // Extract meaningful error information
        const errorMessage = errorData?.error || errorData?.message || 'Failed to create charge';
        const debugInfo = errorData?.debug || {};
        
        console.error('Error details:', { 
          errorMessage, 
          debugInfo,
          hasErrorDetails: !!debugInfo?.errorDetails,
          fullErrorData: errorData
        });
        
        // Create a comprehensive error message
        let fullErrorMessage = `Charge creation failed: ${errorMessage}`;
        
        if (debugInfo && typeof debugInfo === 'object') {
          if (debugInfo.errorDetails?.sdkError?.message) {
            fullErrorMessage += `\n\nSDK Error: ${debugInfo.errorDetails.sdkError.message}`;
          }
          if (debugInfo.duration) {
            fullErrorMessage += `\nRequest duration: ${debugInfo.duration}ms`;
          }
          if (debugInfo.companyId) {
            fullErrorMessage += `\nCompany ID: ${debugInfo.companyId}`;
          }
          if (debugInfo.appId) {
            fullErrorMessage += `\nApp ID: ${debugInfo.appId}`;
          }
        }
        
        throw new Error(fullErrorMessage);
      }

      // Parse successful response
      let inAppPurchase;
      try {
        if (responseText && responseText.trim()) {
          inAppPurchase = JSON.parse(responseText);
          console.log('Received inAppPurchase object:', inAppPurchase);
        } else {
          throw new Error('Empty response from server');
        }
      } catch (parseError) {
        console.error('Failed to parse successful response:', parseError);
        throw new Error('Failed to parse server response');
      }

      // 2. Try to open payment modal using iframe SDK (as per docs)
      if (!iframeSdk || !iframeSdk.inAppPurchase) {
        console.log('iframe SDK not available, trying fallback approach');
        // Fallback: if we have a checkout URL, redirect to it
        if (inAppPurchase.checkout_url) {
          window.location.href = inAppPurchase.checkout_url;
          return;
        } else {
          throw new Error('Payment system not available and no fallback URL');
        }
      }

      const result = await iframeSdk.inAppPurchase(inAppPurchase);
      console.log('Payment result:', result);

      // Handle payment outcomes according to docs
      if (result.status === 'ok') {
        console.log('Payment successful, receipt ID:', result.data.receipt_id);
        // You can store receipt_id for verification via webhooks
      } else {
        console.error('Payment failed:', result.error);
        alert(`Payment failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
      alert(errorMessage);
    }
  };

  return (
    <>
      {/* Sticky Color Slider - Right Side */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-50"
      >
        <div className="flex flex-col items-center gap-4">
          {/* Color Slider */}
          <div className="relative px-3 py-2">
            <div
              ref={sliderRef}
              className="w-6 h-64 rounded-full cursor-pointer relative overflow-visible shadow-lg select-none"
              style={{
                background: `linear-gradient(to bottom, ${COLOR_SPECTRUM.join(', ')})`,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none'
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  moveEvent.preventDefault();
                  if (!sliderRef.current) return;
                  
                  const rect = sliderRef.current.getBoundingClientRect();
                  const y = moveEvent.clientY - rect.top;
                  const position = Math.max(0, Math.min(1, y / rect.height));
                  handleSliderChange(1 - position); // Invert for top=0 position
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                
                // Initial calculation
                if (!sliderRef.current) return;
                const rect = sliderRef.current.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const position = Math.max(0, Math.min(1, y / rect.height));
                handleSliderChange(1 - position);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                const handleTouchMove = (moveEvent: TouchEvent) => {
                  moveEvent.preventDefault();
                  if (!sliderRef.current || !moveEvent.touches[0]) return;
                  
                  const rect = sliderRef.current.getBoundingClientRect();
                  const y = moveEvent.touches[0].clientY - rect.top;
                  const position = Math.max(0, Math.min(1, y / rect.height));
                  handleSliderChange(1 - position);
                };
                
                const handleTouchEnd = () => {
                  document.removeEventListener('touchmove', handleTouchMove);
                  document.removeEventListener('touchend', handleTouchEnd);
                };
                
                document.addEventListener('touchmove', handleTouchMove);
                document.addEventListener('touchend', handleTouchEnd);
                
                // Initial calculation
                if (!sliderRef.current) return;
                const rect = sliderRef.current.getBoundingClientRect();
                const y = e.touches[0].clientY - rect.top;
                const position = Math.max(0, Math.min(1, y / rect.height));
                handleSliderChange(1 - position);
                e.preventDefault();
              }}
            >
              {/* Slider indicator - bigger than slider stripe for magnifying effect */}
              <div
                className="absolute w-10 h-10 rounded-full border-4 pointer-events-none shadow-xl"
                style={{
                  left: '50%',
                  top: `${(1 - sliderPosition) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: color,
                  borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)',
                  zIndex: 10
                }}
              />
            </div>
          </div>

          {/* Color Matching Tool */}
          <motion.button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleColorMatch();
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`w-10 h-10 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center relative z-20 ${
              isColorMatchActive
                ? 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-xl'
                : theme === 'dark' 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white hover:shadow-xl' 
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white hover:shadow-xl'
            }`}
            style={isColorMatchActive ? { backgroundColor: '#f97316', border: 'none' } : { border: 'none' }}
            title={isColorMatchActive ? "Color match active - click pixels to copy colors" : "Toggle color match mode"}
          >
            {isColorMatchActive ? (
              // Active state - pipette icon
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l10.71-10.71 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42zM6.92 19L5 17.08l8.71-8.71 1.92 1.92L6.92 19z"/>
              </svg>
            ) : (
              // Inactive state - pipette icon
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l10.71-10.71 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42zM6.92 19L5 17.08l8.71-8.71 1.92 1.92L6.92 19z" opacity="0.6"/>
              </svg>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Mobile Top Controls */}
      {isMobile && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 z-50 p-4"
        >
          <div className="flex items-center gap-3">
            {/* Settings Button */}
            <motion.button
              onClick={() => {
                setShowSettings(!showSettings);
;
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
                showSettings 
                  ? theme === 'dark' ? 'bg-zinc-800/80' : 'bg-gray-800/80'
                  : theme === 'dark' 
                    ? 'bg-zinc-800/60 hover:bg-zinc-800/80 text-zinc-300 hover:text-white'
                    : 'bg-gray-200/60 hover:bg-gray-200/80 text-gray-700 hover:text-black'
              }`}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Place Button - Mobile Bottom Center or Desktop Layout */}
      {isMobile ? (
        // Mobile: Centered bottom place button
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
        >
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
              className="relative px-8 py-3 rounded-full font-semibold text-lg tracking-wide transition-all duration-200 bg-orange-500 hover:bg-orange-600 text-white shadow-2xl hover:shadow-3xl z-10 disabled:bg-orange-500 disabled:opacity-100"
              style={{ backgroundColor: '#f97316' }}
            >
              {isPlacing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Placing...</span>
                </span>
              ) : timeRemaining > 0 ? (
                <span className="flex items-center gap-2 font-mono text-lg">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
        </motion.div>
      ) : (
        // Desktop: Full bottom tab layout
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
          className={`fixed bottom-0 left-0 right-0 z-50 ${
            theme === 'dark' ? 'bg-zinc-900/40' : 'bg-white/40'
          } backdrop-blur-md`}
        >
          <div className="relative flex items-center justify-center px-6 py-4">
          {/* Center - Place Button and Cooldown Button */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-4" style={{ top: '-40px' }}>
            {/* Place Button */}
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

            {/* Cooldown Button */}
            <motion.button
              onClick={handleCheckout}
              disabled={userLoading}
              whileHover={!userLoading ? { y: -2 } : {}}
              whileTap={!userLoading ? { scale: 0.98 } : {}}
              className={`px-6 py-3.5 rounded-full font-semibold text-lg tracking-wide transition-all duration-200 ${
                userLoading
                  ? 'bg-gray-600 cursor-not-allowed opacity-50 text-gray-300' 
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-2xl hover:shadow-3xl'
              }`}
              style={!userLoading ? { 
                backgroundColor: '#10b981',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)'
              } : {}}
            >
              <span className="flex items-center gap-2.5">
                {userLoading ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                )}
                <span>
                  {userLoading ? 'Authenticating...' : 'No Cooldown'}
                </span>
              </span>
            </motion.button>
          </div>

          {/* Right side - Settings */}
          <div className="absolute right-6 flex items-center gap-3" style={{ top: '-40px' }}>
            {/* Settings Button - theme aware */}
            <motion.button
              onClick={() => {
                setShowSettings(!showSettings);
;
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 ${
                showSettings 
                  ? theme === 'dark' ? 'bg-zinc-800/80' : 'bg-gray-800/80'
                  : theme === 'dark' 
                    ? 'bg-zinc-800/60 hover:bg-zinc-800/80 text-zinc-300 hover:text-white'
                    : 'bg-gray-200/60 hover:bg-gray-200/80 text-gray-700 hover:text-black'
              }`}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </motion.button>
          </div>
        </div>
      </motion.div>
      )}


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
              className={`fixed rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.8)] p-6 z-50 min-w-[280px] backdrop-blur-xl ${
                isMobile ? 'top-20 left-4' : 'bottom-24 right-6'
              } ${
                theme === 'dark' ? 'bg-zinc-900/95' : 'bg-white/95'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={`text-lg font-semibold mb-5 ${
                theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
              }`}>Pixel Settings</h3>
              
              <div className="space-y-3">
                {/* Link Info */}
                <div className={`rounded-xl p-4 ${
                  theme === 'dark' ? 'bg-zinc-800/30' : 'bg-gray-100/50'
                }`}>
                  <p className={`text-xs mb-2 ${
                    theme === 'dark' ? 'text-zinc-500' : 'text-gray-600'
                  }`}>
                    All pixels placed will display your desired product link.
                  </p>
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://your-link.com"
                    className={`w-full px-4 py-2.5 rounded-xl focus:outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 text-zinc-100 placeholder:text-zinc-500'
                        : 'bg-white text-gray-900 placeholder:text-gray-500 border border-gray-300'
                    }`}
                  />
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowSettings(false)}
                className={`mt-5 w-full py-2.5 rounded-xl transition-all duration-200 font-medium text-sm border ${
                  theme === 'dark' 
                    ? 'bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border-zinc-700'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800 border-gray-400'
                }`}
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

