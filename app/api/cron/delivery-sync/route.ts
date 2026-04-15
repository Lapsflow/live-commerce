/**
 * Vercel Cron: Delivery Status Synchronization
 * Runs every 10 minutes to sync delivery statuses with ONEWMS
 * Schedule: every 10 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncDeliveryStatuses } from '@/lib/services/onewms/deliverySync';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting scheduled delivery sync...');

    // Run delivery synchronization
    const result = await syncDeliveryStatuses();

    console.log('Scheduled delivery sync completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Delivery sync completed',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron delivery sync failed:', error);
    const message = error instanceof Error ? error.message : 'Delivery sync failed';

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
