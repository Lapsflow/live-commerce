import type { User } from "./user";

export type BroadcastPlatform = "GRIP" | "CLME" | "YOUTUBE" | "TIKTOK" | "BAND" | "OTHER";
export type BroadcastStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELED";

export interface Center {
  id: string;
  code: string;
  name: string;
  region: string;
}

export interface Broadcast {
  id: string;
  code: string;
  sellerId: string;
  seller?: User;
  centerId: string | null;
  center?: Center;
  platform: BroadcastPlatform;
  scheduledAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  status: BroadcastStatus;
  memo: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BroadcastFormData = {
  sellerId: string;
  platform: BroadcastPlatform;
  scheduledAt: Date;
  memo?: string;
};
