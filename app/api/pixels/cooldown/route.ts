import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

const COOLDOWN_MINUTES = 15;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get user's last placement time
    const { data: cooldownData, error: cooldownError } = await supabase
      .from('user_cooldowns')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (cooldownError || !cooldownData) {
      // User has never placed a pixel
      return NextResponse.json({
        canPlace: true,
        cooldownEnd: null,
      });
    }

    const lastPlacement = new Date((cooldownData as Database['public']['Tables']['user_cooldowns']['Row']).last_placement);
    const now = new Date();
    const minutesSinceLastPlacement = (now.getTime() - lastPlacement.getTime()) / (1000 * 60);

    if (minutesSinceLastPlacement >= COOLDOWN_MINUTES) {
      return NextResponse.json({
        canPlace: true,
        cooldownEnd: null,
      });
    }

    const cooldownEnd = new Date(lastPlacement.getTime() + COOLDOWN_MINUTES * 60 * 1000);

    return NextResponse.json({
      canPlace: false,
      cooldownEnd: cooldownEnd.toISOString(),
      remainingMinutes: Math.ceil(COOLDOWN_MINUTES - minutesSinceLastPlacement),
    });
  } catch (error) {
    console.error('Error checking cooldown:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

