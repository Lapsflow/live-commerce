import { createCrudHandler } from "@/lib/api/create-crud-handler-prisma";
import { z } from "zod";

const saleSchema = z.object({
  saleNo: z.string().min(1).max(50),
  sellerId: z.string().cuid(),
  productId: z.string().cuid(),
  broadcastId: z.string().cuid().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
  totalPrice: z.number().int().min(0),
  saleDate: z.string().datetime().optional(),
});

export const { list: GET, create: POST } = createCrudHandler({
  model: "sale",
  roles: {
    read: ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
    write: ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  },
  createSchema: saleSchema,
  updateSchema: saleSchema.partial(),
  sortableFields: ["saleNo", "quantity", "totalPrice", "saleDate", "createdAt"],
  searchFields: ["saleNo"],
  excludeFields: [],
});
