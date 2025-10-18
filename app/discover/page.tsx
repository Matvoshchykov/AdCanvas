'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DiscoverPage() {
	const router = useRouter();

	useEffect(() => {
		// Redirect to PixelBoard
		router.push('/pixelboard');
	}, [router]);

	return (
		<div className="min-h-screen bg-[#0e0e10] flex items-center justify-center">
			<div className="text-center">
				<h1 className="text-5xl font-bold text-white mb-6 text-center">
					Redirecting to PixelBoard...
				</h1>
				<div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
			</div>
		</div>
	);
}
