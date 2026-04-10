import { NextRequest, NextResponse } from 'next/server';
import { syncAllWarehouses } from '@/lib/services/warehouse/sync';

/**
 * Cron endpoint for daily warehouse inventory synchronization
 *
 * Schedule: Every day at 9:00 AM KST (configured in vercel.json)
 * Authentication: Bearer token from CRON_SECRET env var
 *
 * This endpoint:
 * 1. Fetches inventory data from Google Spreadsheets for each enabled warehouse
 * 2. Updates WarehouseInventory table with latest quantities
 * 3. Creates products if they don't exist (based on barcode)
 * 4. Returns sync results for all warehouses
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Verify cron authentication
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('[Warehouse Sync] Starting daily sync...');
    const startTime = Date.now();

    const results = await syncAllWarehouses();

    const duration = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + r.recordsProcessed, 0);

    console.log(`[Warehouse Sync] Completed in ${duration}ms`);
    console.log(`[Warehouse Sync] Success: ${successCount}, Failed: ${failCount}`);
    console.log(`[Warehouse Sync] Total records: ${totalRecords}`);

    return NextResponse.json({
      success: true,
      message: 'Warehouse sync completed',
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
        recordsProcessed: totalRecords,
      },
      results: results.map((r) => ({
        warehouse: r.warehouseName,
        success: r.success,
        records: r.recordsProcessed,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error('[Warehouse Sync] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
