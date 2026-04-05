import { createCrudHandler } from "@/lib/api/create-crud-handler-prisma";
import { z } from "zod";

const orderSchema = z.object({
  orderNo: z.string().min(1).max(50),
  sellerId: z.string().cuid(),
  adminId: z.string().cuid().optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  totalAmount: z.number().int().min(0).optional(),
  memo: z.string().max(500).optional(),
  uploadedAt: z.string().datetime().optional(),
  approvedAt: z.string().datetime().optional(),
});

export const { get: GET, update: PUT, remove: DELETE } = createCrudHandler({
  model: "order",
  roles: {
    read: ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
    write: ["MASTER", "SUB_MASTER", "ADMIN"],
    delete: ["MASTER", "SUB_MASTER"],
  },
  createSchema: orderSchema,
  updateSchema: orderSchema.partial(),
  sortableFields: ["orderNo", "status", "totalAmount", "uploadedAt", "createdAt"],
  searchFields: ["orderNo"],
  excludeFields: [],
});
