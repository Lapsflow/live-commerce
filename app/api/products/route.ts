import { createCrudHandler } from "@/lib/api/create-crud-handler-prisma";
import { z } from "zod";

const productSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  barcode: z.string().min(1).max(50),
  sellPrice: z.number().int().min(0),
  supplyPrice: z.number().int().min(0),
  totalStock: z.number().int().min(0).optional(),
  stockMujin: z.number().int().min(0).optional(),
  stock1: z.number().int().min(0).optional(),
  stock2: z.number().int().min(0).optional(),
  stock3: z.number().int().min(0).optional(),
});

export const { list: GET, create: POST } = createCrudHandler({
  model: "product",
  roles: {
    read: ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
    write: ["MASTER", "SUB_MASTER", "ADMIN"],
  },
  createSchema: productSchema,
  updateSchema: productSchema.partial(),
  sortableFields: ["code", "name", "sellPrice", "totalStock", "createdAt"],
  searchFields: ["code", "name", "barcode"],
  excludeFields: [],
});
