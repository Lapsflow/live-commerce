/**
 * POST /api/onewms/stock/conflicts/[id]/resolve
 * Resolve a stock conflict
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveConflict } from '@/lib/services/onewms/stockSync';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN, SUB_MASTER, or MASTER can resolve conflicts
    const allowedRoles = ['ADMIN', 'SUB_MASTER', 'MASTER'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { resolution } = body;

    if (!resolution || !['onewms', 'local', 'ignore'].includes(resolution)) {
      return NextResponse.json(
        { error: 'Invalid resolution. Must be: onewms, local, or ignore' },
        { status: 400 }
      );
    }

    // Resolve conflict
    const result = await resolveConflict(
      id,
      resolution as 'onewms' | 'local' | 'ignore'
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Conflict resolved successfully',
    });
  } catch (error: any) {
    console.error('Failed to resolve conflict:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to resolve conflict',
      },
      { status: 500 }
    );
  }
}
