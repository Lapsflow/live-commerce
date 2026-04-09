/**
 * Vercel Cron: Stock Synchronization
 * Runs every 6 hours to sync stock with ONEWMS
 * Schedule: 0 */6 * * * (every 6 hours)
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllStocks } from '@/lib/services/onewms/stockSync';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Invalid cron authorization');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Starting scheduled stock sync...');

    // Run stock synchronization
    const stats = await syncAllStocks();

    console.log('Scheduled stock sync completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Stock sync completed',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Cron stock sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Stock sync failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
