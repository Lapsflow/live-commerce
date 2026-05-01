export type Role = "MASTER" | "SUB_MASTER" | "SELLER";

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
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
  channels?: string[];
};
