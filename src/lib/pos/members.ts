/** Program membership / loyalitas pelanggan. */
import type { LoyaltySettings, Member, MemberPoint, PosDatabase, StoreSettings } from "./types";

export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: true,
  earnPerAmount: 10000,
  pointValue: 100,
  minRedeem: 10,
  memberDiscountPercent: 0,
};

export function loyaltyOf(settings: StoreSettings): LoyaltySettings {
  return { ...DEFAULT_LOYALTY, ...(settings.loyalty ?? {}) };
}

export function membersOf(db: PosDatabase): Member[] {
  return db.members ?? [];
}

export function memberPointsOf(db: PosDatabase): MemberPoint[] {
  return db.memberPoints ?? [];
}

/** Poin yang didapat dari nilai belanja. */
export function pointsFromSpend(amount: number, loyalty: LoyaltySettings): number {
  if (!loyalty.enabled || loyalty.earnPerAmount <= 0 || amount <= 0) return 0;
  return Math.floor(amount / loyalty.earnPerAmount);
}

/** Nilai rupiah dari sejumlah poin. */
export function pointsToRupiah(points: number, loyalty: LoyaltySettings): number {
  return Math.max(0, Math.round(points * Math.max(0, loyalty.pointValue)));
}

/** Poin maksimum yang boleh ditukar untuk tagihan tertentu. */
export function maxRedeemable(member: Member, billable: number, loyalty: LoyaltySettings): number {
  if (!loyalty.enabled || loyalty.pointValue <= 0) return 0;
  if (member.points < loyalty.minRedeem) return 0;
  return Math.min(member.points, Math.floor(billable / loyalty.pointValue));
}

/** Diskon otomatis khusus member (rupiah). */
export function memberDiscountOf(base: number, loyalty: LoyaltySettings): number {
  if (!loyalty.enabled || loyalty.memberDiscountPercent <= 0) return 0;
  return Math.round((Math.max(0, base) * loyalty.memberDiscountPercent) / 100);
}

export function nextMemberCode(db: PosDatabase): string {
  const nums = membersOf(db)
    .map((m) => Number(m.code.replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return "MBR-" + String(next).padStart(6, "0");
}

/** Cari member berdasarkan nama, nomor telepon, atau kode. */
export function searchMembers(db: PosDatabase, query: string): Member[] {
  const q = query.trim().toLowerCase();
  const list = membersOf(db).filter((m) => m.active);
  if (!q) return list.slice(0, 30);
  return list
    .filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        m.code.toLowerCase().includes(q),
    )
    .slice(0, 30);
}

export function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}
