import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a Supabase client with service role for backend operations
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

const COOLDOWN_MINUTES = 10;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { x, y, color, link, userId, userName } = body;

    // Validate required fields
    if (typeof x !== 'number' || typeof y !== 'number' || !color || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: x, y, color, userId' },
        { status: 400 }
      );
    }

    // Validate coordinates (600 width x 400 height grid)
    const GRID_WIDTH = 600;
    const GRID_HEIGHT = 400;
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      return NextResponse.json(
        { error: `Coordinates must be between 0-${GRID_WIDTH - 1} (x) and 0-${GRID_HEIGHT - 1} (y)` },
        { status: 400 }
      );
    }

    // Validate color format (hex color)
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      return NextResponse.json(
        { error: 'Invalid color format. Must be a hex color (e.g., #FF0000)' },
        { status: 400 }
      );
    }

    // Validate link if provided
    if (link && link.length > 0) {
      try {
        new URL(link);
      } catch {
        return NextResponse.json(
          { error: 'Invalid link URL format' },
          { status: 400 }
        );
      }
    }

    // Check if pixel already exists at this position
    const { data: existingPixel } = await supabase
      .from('pixels')
      .select('*')
      .eq('x', x)
      .eq('y', y)
      .single();

    if (existingPixel) {
      return NextResponse.json(
        { error: 'A pixel already exists at this position' },
        { status: 409 }
      );
    }

    // Check cooldown
    const { data: cooldownData } = await supabase
      .from('user_cooldowns')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (cooldownData) {
      const lastPlacement = new Date(cooldownData.last_placement);
      const now = new Date();
      const minutesSinceLastPlacement = (now.getTime() - lastPlacement.getTime()) / (1000 * 60);

      if (minutesSinceLastPlacement < COOLDOWN_MINUTES) {
        const remainingMinutes = COOLDOWN_MINUTES - minutesSinceLastPlacement;
        const cooldownEnd = new Date(lastPlacement.getTime() + COOLDOWN_MINUTES * 60 * 1000);
        
        return NextResponse.json(
          {
            error: 'Cooldown active',
            remainingMinutes: Math.ceil(remainingMinutes),
            cooldownEnd: cooldownEnd.toISOString(),
          },
          { status: 429 }
        );
      }
    }

    // Place the pixel
    const { data: newPixel, error: insertError } = await supabase
      .from('pixels')
      .insert({
        x,
        y,
        color,
        link: link || null,
        owner_id: userId,
        owner_name: userName || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting pixel:', insertError);
      return NextResponse.json(
        { error: 'Failed to place pixel', details: insertError.message },
        { status: 500 }
      );
    }

    // Update cooldown (trigger will handle this, but we can also do it manually)
    const { error: cooldownError } = await supabase
      .from('user_cooldowns')
      .upsert({
        user_id: userId,
        last_placement: new Date().toISOString(),
      });

    if (cooldownError) {
      console.error('Error updating cooldown:', cooldownError);
      // Don't fail the request if cooldown update fails
    }

    // Calculate next available placement time
    const cooldownEnd = new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000);

    return NextResponse.json({
      success: true,
      pixel: newPixel,
      cooldownEnd: cooldownEnd.toISOString(),
    });
  } catch (error) {
    console.error('Error in place pixel API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

