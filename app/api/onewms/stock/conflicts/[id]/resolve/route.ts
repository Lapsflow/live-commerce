/**
 * POST /api/onewms/stock/conflicts/[id]/resolve
 * Resolve a stock conflict
 */

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { resolveConflict } from '@/lib/services/onewms/stockSync';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN, SUB_MASTER, or MASTER can resolve conflicts
    const allowedRoles = ['ADMIN', 'SUB_MASTER', 'MASTER'];
    if (!session.user?.role || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;
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
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
    const message = error instanceof Error ? error.message : 'Failed to resolve conflict';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
