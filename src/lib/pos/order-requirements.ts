import type { ServiceType } from "./types";

/** Dine In needs a table even when selected automatically or restored locally. */
export function needsDiningTable(
  service: Pick<ServiceType, "kind"> | null | undefined,
  orderType: string,
  tableName: string,
): boolean {
  return (service?.kind === "dinein" || (!service && orderType.trim().toLowerCase() === "dine in")) && !tableName.trim();
}