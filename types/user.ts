export type Role = "MASTER" | "SUB_MASTER" | "ADMIN" | "SELLER";

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  adminId: string | null;
  admin?: User;
  sellers?: User[];
  channels: string[];
  avgSales: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserFormData = {
  email: string;
  name: string;
  phone?: string;
  role: Role;
  adminId?: string;
  channels?: string[];
};
