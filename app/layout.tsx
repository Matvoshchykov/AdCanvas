'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

// Iframe detection hook
function useWhopIframeDetection() {
	const [isInsideWhop, setIsInsideWhop] = useState<boolean | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const checkIframeContext = () => {
			try {
				// Check if we're in an iframe
				const inIframe = window !== window.top;
				
				// Check if we're in Whop's iframe specifically
				let inWhopIframe = false;
				
				if (inIframe) {
					// Check if parent window is from Whop
					try {
						// Try to access parent location (will throw if cross-origin, which is expected for Whop)
						const parentOrigin = window.parent.location.origin;
						inWhopIframe = parentOrigin.includes('whop.com');
					} catch {
						// Cross-origin access means we're likely in Whop iframe
						inWhopIframe = true;
					}
					
					// Additional checks for Whop-specific context
					if (document.referrer && document.referrer.includes('whop.com')) {
						inWhopIframe = true;
					}
				}

				// Final check: Try to detect Whop SDK injection
				if (inIframe && typeof window !== 'undefined') {
					// Check for Whop-specific global objects or messages
					setTimeout(() => {
						setIsInsideWhop(inWhopIframe);
						setIsLoading(false);
					}, 100);
				} else {
					setIsInsideWhop(false);
					setIsLoading(false);
				}
			} catch (error) {
				console.error('Error detecting iframe context:', error);
				setIsInsideWhop(false);
				setIsLoading(false);
			}
		};

		// Run detection
		checkIframeContext();

		// Listen for messages that might indicate Whop context
		const handleMessage = (event: MessageEvent) => {
			if (event.origin.includes('whop.com') || 
			    (event.data && typeof event.data === 'object' && event.data.type?.includes('whop'))) {
				setIsInsideWhop(true);
				setIsLoading(false);
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	return { isInsideWhop, isLoading };
}

// Component to show when not in Whop iframe
function WhopIframeRequired() {
	return (
		<div className="min-h-screen bg-[#0e0e10] flex items-center justify-center p-4">
			<div className="max-w-md mx-auto text-center">
				<div className="mb-8">
					{/* Whop Logo or Icon */}
					<div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
						<svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
						</svg>
					</div>
					<h1 className="text-2xl font-bold text-white mb-2">
						Whop Native App
					</h1>
					<p className="text-gray-400 text-lg leading-relaxed">
						This app must be accessed from within{" "}
						<span className="text-purple-400 font-medium">Whop.com</span>
					</p>
				</div>
				
				<div className="space-y-4 text-gray-500">
					<div className="flex items-center justify-center space-x-2">
						<div className="w-2 h-2 bg-red-500 rounded-full"></div>
						<span className="text-sm">App not running in Whop iframe</span>
					</div>
					<p className="text-sm">
						Please access this app through your Whop dashboard to use all features.
					</p>
				</div>

				<div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
					<p className="text-xs text-gray-400">
						This is a native Whop app that integrates with Whop's authentication and user management systems.
					</p>
				</div>
			</div>
		</div>
	);
}

// Whop wrapper with iframe enforcement
function WhopWrapper({ children }: { children: React.ReactNode }) {
	const [mounted, setMounted] = useState(false);
	const [WhopApp, setWhopApp] = useState<any>(null);
	const { isInsideWhop, isLoading } = useWhopIframeDetection();

	useEffect(() => {
		setMounted(true);
		// Try to load WhopApp
		try {
			import("@whop/react/components").then((mod) => {
				setWhopApp(() => mod.WhopApp);
			}).catch(() => {
				console.log("Whop SDK not available");
			});
		} catch {
			console.log("Failed to load Whop SDK");
		}
	}, []);

	if (!mounted || isLoading) {
		return (
			<div className="min-h-screen bg-[#0e0e10] flex items-center justify-center">
				<div className="text-center">
					<div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
					<p className="text-gray-400">Loading...</p>
				</div>
			</div>
		);
	}

	// For development: Always try to render with WhopApp if available, regardless of iframe detection
	// This allows local development while still working in production Whop iframe
	if (WhopApp) {
		return <WhopApp>{children}</WhopApp>;
	}

	// If not inside Whop iframe and no WhopApp available, show the required message
	if (isInsideWhop === false) {
		return <WhopIframeRequired />;
	}

	// Fallback: render children (for development or edge cases)
	return <>{children}</>;
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<title>Whop PixelBoard - Collaborative Pixel Art</title>
				<meta name="description" content="A Reddit r/place inspired pixel board game for Whop communities. Place pixels, share links, and promote your products!" />
			</head>
			<body className={`${inter.variable} antialiased font-sans`}>
				<ThemeProvider>
					<WhopWrapper>{children}</WhopWrapper>
				</ThemeProvider>
			</body>
		</html>
	);
}
