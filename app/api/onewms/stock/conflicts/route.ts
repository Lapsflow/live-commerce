/**
 * GET /api/onewms/stock/conflicts
 * List all unresolved stock conflicts
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getStockConflicts } from '@/lib/services/onewms/stockSync';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all conflicts
    const conflicts = await getStockConflicts();

    return NextResponse.json({
      success: true,
      data: conflicts,
      count: conflicts.length,
    });
  } catch (error) {
    console.error('Failed to fetch stock conflicts:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch conflicts';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
