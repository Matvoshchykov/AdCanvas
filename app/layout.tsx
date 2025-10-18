'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect, useState } from "react";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

// Development-safe Whop wrapper
function WhopWrapper({ children }: { children: React.ReactNode }) {
	const [mounted, setMounted] = useState(false);
	const [WhopApp, setWhopApp] = useState<any>(null);

	useEffect(() => {
		setMounted(true);
		// Try to load WhopApp, but don't fail if it's not available
		try {
			import("@whop/react/components").then((mod) => {
				setWhopApp(() => mod.WhopApp);
			}).catch(() => {
				// Whop not available, continue without it
				console.log("Running in development mode without Whop authentication");
			});
		} catch {
			console.log("Running in development mode without Whop authentication");
		}
	}, []);

	if (!mounted) {
		return <>{children}</>;
	}

	if (WhopApp) {
		return <WhopApp>{children}</WhopApp>;
	}

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
				<WhopWrapper>{children}</WhopWrapper>
			</body>
		</html>
	);
}
