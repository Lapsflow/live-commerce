import type { User } from "./user";

export type BroadcastPlatform = "GRIP" | "CLME" | "YOUTUBE" | "TIKTOK" | "BAND" | "OTHER";
export type BroadcastStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELED";

export interface Broadcast {
  id: string;
  code: string;
  sellerId: string;
  seller?: User;
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
