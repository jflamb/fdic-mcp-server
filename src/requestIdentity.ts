import type { Request } from "express";

export function getRequestIp(req: Request): string {
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || req.ip || "unknown";
  }

  return req.ip || "unknown";
}
