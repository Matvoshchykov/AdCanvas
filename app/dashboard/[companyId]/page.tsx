'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to PixelBoard when accessed via Whop
		router.push('/pixelboard');
	}, [router]);

	return (
		<div className="min-h-screen bg-[#0e0e10] flex items-center justify-center">
			<div className="text-center">
				<div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
				<p className="text-gray-400 text-lg">Redirecting to PixelBoard...</p>
			</div>
		</div>
	);
}

