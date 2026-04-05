import { createCrudHandler } from "@/lib/api/create-crud-handler-prisma";
import { z } from "zod";

const broadcastSchema = z.object({
  code: z.string().min(1).max(50),
  sellerId: z.string().cuid(),
  platform: z.enum(["GRIP", "CLME", "YOUTUBE", "TIKTOK", "BAND", "OTHER"]),
  scheduledAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELED"]).optional(),
  memo: z.string().max(500).optional(),
});

export const { list: GET, create: POST } = createCrudHandler({
  model: "broadcast",
  roles: {
    read: ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
    write: ["MASTER", "SUB_MASTER", "ADMIN", "SELLER"],
  },
  createSchema: broadcastSchema,
  updateSchema: broadcastSchema.partial(),
  sortableFields: ["code", "platform", "status", "scheduledAt", "createdAt"],
  searchFields: ["code"],
  excludeFields: [],
});
