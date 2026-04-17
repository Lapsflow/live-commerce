import { NextRequest } from 'next/server';
import { withRole, AuthUser } from '@/lib/api/middleware';
import { prisma } from '@/lib/db/prisma';
import { ok, paginated, errors } from '@/lib/api/response';
import { normBarcode } from '@/lib/utils/barcode';
import { z } from 'zod';

const barcodeMasterCreateSchema = z.object({
  barcode: z.string().min(1, "바코드는 필수입니다"),
  standardName: z.string().min(1, "표준명은 필수입니다"),
  category: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  specifications: z.record(z.string(), z.unknown()).nullable().optional(),
});

const barcodeMasterUpdateSchema = z.object({
  id: z.string().min(1, "ID는 필수입니다"),
  standardName: z.string().optional(),
  category: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  specifications: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Barcode Master API
 *
 * Manages official barcode registry (한국무진 exclusive)
 * Only MASTER role can create/update barcode master records
 */

// GET /api/barcode-master - List all barcode masters
export const GET = withRole(["MASTER", "ADMIN", "SELLER"], async (req: NextRequest, _user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const isActive = searchParams.get('isActive');
  const pageIndex = Math.max(0, parseInt(searchParams.get('pageIndex') || '0'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')));

  const where: Record<string, unknown> = {};

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
    prisma.barcodeMaster.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pageIndex * pageSize,
      take: pageSize,
    }),
    prisma.barcodeMaster.count({ where }),
  ]);

  return paginated(barcodes, total, pageSize);
});

// POST /api/barcode-master - Create new barcode master
export const POST = withRole(["MASTER"], async (req: NextRequest, user: AuthUser) => {
  const body = await req.json();
  const parsed = barcodeMasterCreateSchema.safeParse(body);

  if (!parsed.success) {
    return errors.badRequest(parsed.error.issues[0].message, parsed.error.issues);
  }

  const { barcode, standardName, category, manufacturer, specifications } = parsed.data;
  const normalized = normBarcode(barcode);

  const existing = await prisma.barcodeMaster.findUnique({
    where: { barcode: normalized },
  });

  if (existing) {
    return errors.conflict('이미 등록된 바코드입니다');
  }

  const master = await prisma.barcodeMaster.create({
    data: {
      barcode: normalized,
      standardName,
      category: category || null,
      manufacturer: manufacturer || null,
      specifications: specifications ? JSON.stringify(specifications) : null,
      registeredBy: user.userId,
      isActive: true,
    },
  });

  return ok(master);
});

// PUT /api/barcode-master - Update barcode master
export const PUT = withRole(["MASTER"], async (req: NextRequest, _user: AuthUser) => {
  const body = await req.json();
  const parsed = barcodeMasterUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return errors.badRequest(parsed.error.issues[0].message, parsed.error.issues);
  }

  const { id, standardName, category, manufacturer, specifications, isActive } = parsed.data;

  const master = await prisma.barcodeMaster.update({
    where: { id },
    data: {
      standardName: standardName || undefined,
      category: category !== undefined ? category : undefined,
      manufacturer: manufacturer !== undefined ? manufacturer : undefined,
      specifications: specifications ? JSON.stringify(specifications) : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    },
  });

  return ok(master);
});

// DELETE /api/barcode-master - Deactivate barcode master
export const DELETE = withRole(["MASTER"], async (req: NextRequest, _user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return errors.badRequest('ID는 필수입니다');
  }

  const master = await prisma.barcodeMaster.update({
    where: { id },
    data: { isActive: false },
  });

  return ok(master);
});
