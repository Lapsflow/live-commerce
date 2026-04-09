/**
 * GET /api/onewms/stock/conflicts
 * List all unresolved stock conflicts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStockConflicts } from '@/lib/services/onewms/stockSync';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
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
  } catch (error: any) {
    console.error('Failed to fetch stock conflicts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch conflicts',
      },
      { status: 500 }
    );
  }
}
