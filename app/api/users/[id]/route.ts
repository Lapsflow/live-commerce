import { createCrudHandler } from "@/lib/api/create-crud-handler-prisma";
import { z } from "zod";

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  role: z.enum(["MASTER", "SUB_MASTER", "ADMIN", "SELLER"]).optional(),
  adminId: z.string().cuid().optional(),
});

export const { get: GET, update: PUT, remove: DELETE } = createCrudHandler({
  model: "user",
  roles: {
    read: ["MASTER", "SUB_MASTER", "ADMIN"],
    write: ["MASTER", "SUB_MASTER"],
    delete: ["MASTER"],
  },
  createSchema: userSchema,
  updateSchema: userSchema.partial(),
  sortableFields: ["email", "name", "role", "createdAt"],
  searchFields: ["email", "name", "phone"],
  excludeFields: ["passwordHash"],
});
