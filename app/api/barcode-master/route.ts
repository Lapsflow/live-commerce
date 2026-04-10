import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { normBarcode } from '@/lib/utils/barcode';

/**
 * Barcode Master API
 *
 * Manages official barcode registry (한국무진 exclusive)
 * Only MASTER role can create/update barcode master records
 */

// GET /api/barcode-master - List all barcode masters
export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const isActive = searchParams.get('isActive');
  const pageIndex = parseInt(searchParams.get('pageIndex') || '0');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');

  try {
    const where: any = {};

    if (search) {
      where.OR = [
        { barcode: { contains: search, mode: 'insensitive' } },
        { standardName: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [barcodes, total] = await Promise.all([
      db.barcodeMaster.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pageIndex * pageSize,
        take: pageSize,
      }),
      db.barcodeMaster.count({ where }),
    ]);

    return NextResponse.json({
      data: barcodes,
      pagination: {
        pageIndex,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[Barcode Master] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch barcode masters' },
      { status: 500 }
    );
  }
}

// POST /api/barcode-master - Create new barcode master
export async function POST(req: NextRequest) {
  const session = await auth();

  // Only MASTER role can register official barcodes
  if (session?.user?.role !== 'MASTER') {
    return NextResponse.json(
      { error: 'Only Master role can register barcodes' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { barcode, standardName, category, manufacturer, specifications } = body;

    if (!barcode || !standardName) {
      return NextResponse.json(
        { error: 'Barcode and standardName are required' },
        { status: 400 }
      );
    }

    const normalized = normBarcode(barcode);

    // Check if barcode already exists
    const existing = await db.barcodeMaster.findUnique({
      where: { barcode: normalized },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Barcode already registered' },
        { status: 409 }
      );
    }

    const master = await db.barcodeMaster.create({
      data: {
        barcode: normalized,
        standardName,
        category: category || null,
        manufacturer: manufacturer || null,
        specifications: specifications ? JSON.stringify(specifications) : null,
        registeredBy: session.user.id!,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: master });
  } catch (error) {
    console.error('[Barcode Master] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create barcode master' },
      { status: 500 }
    );
  }
}

// PUT /api/barcode-master - Update barcode master
export async function PUT(req: NextRequest) {
  const session = await auth();

  if (session?.user?.role !== 'MASTER') {
    return NextResponse.json(
      { error: 'Only Master role can update barcodes' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, standardName, category, manufacturer, specifications, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const master = await db.barcodeMaster.update({
      where: { id },
      data: {
        standardName: standardName || undefined,
        category: category !== undefined ? category : undefined,
        manufacturer: manufacturer !== undefined ? manufacturer : undefined,
        specifications: specifications ? JSON.stringify(specifications) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json({ success: true, data: master });
  } catch (error) {
    console.error('[Barcode Master] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update barcode master' },
      { status: 500 }
    );
  }
}

// DELETE /api/barcode-master - Deactivate barcode master
export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (session?.user?.role !== 'MASTER') {
    return NextResponse.json(
      { error: 'Only Master role can delete barcodes' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    // Soft delete by setting isActive = false
    const master = await db.barcodeMaster.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, data: master });
  } catch (error) {
    console.error('[Barcode Master] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate barcode master' },
      { status: 500 }
    );
  }
}
