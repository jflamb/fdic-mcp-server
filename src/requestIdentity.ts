import type { Request } from "express";
import { isIP } from "node:net";

export interface IpBlockRule {
  raw: string;
  version: 4 | 6;
  address: bigint;
  prefixLength: number;
}

export function getRequestIp(req: Request): string {
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || req.ip || "unknown";
  }

  return req.ip || "unknown";
}

export function parseBlockedIpRules(rawRules: string | undefined): IpBlockRule[] {
  if (!rawRules) {
    return [];
  }

  return rawRules
    .split(/[\s,]+/)
    .map((rule) => rule.trim())
    .filter((rule) => rule.length > 0)
    .map(parseBlockedIpRule);
}

export function isBlockedIp(ip: string, rules: IpBlockRule[]): boolean {
  const parsedIp = parseIpAddress(ip);
  if (!parsedIp) {
    return false;
  }

  return rules.some((rule) => {
    if (rule.version !== parsedIp.version) {
      return false;
    }

    const totalBits = rule.version === 4 ? 32n : 128n;
    const hostBits = totalBits - BigInt(rule.prefixLength);
    const mask = ((1n << totalBits) - 1n) ^ ((1n << hostBits) - 1n);
    return (parsedIp.address & mask) === (rule.address & mask);
  });
}

function parseBlockedIpRule(rawRule: string): IpBlockRule {
  const [rawIp, rawPrefix] = rawRule.split("/", 2);
  const parsedIp = parseIpAddress(rawIp);
  if (!parsedIp) {
    throw new Error(`Invalid MCP_BLOCKED_IPS entry: ${rawRule}`);
  }

  const maxPrefix = parsedIp.version === 4 ? 32 : 128;
  const prefixLength =
    rawPrefix === undefined ? maxPrefix : Number.parseInt(rawPrefix, 10);
  if (
    !Number.isInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > maxPrefix
  ) {
    throw new Error(`Invalid MCP_BLOCKED_IPS prefix: ${rawRule}`);
  }

  return {
    raw: rawRule,
    version: parsedIp.version,
    address: parsedIp.address,
    prefixLength,
  };
}

function parseIpAddress(ip: string | undefined): { version: 4 | 6; address: bigint } | undefined {
  if (!ip) {
    return undefined;
  }

  const normalizedIp = ip.trim().replace(/^\[/, "").replace(/\]$/, "");
  const version = isIP(normalizedIp);
  if (version === 4) {
    return { version, address: parseIpv4(normalizedIp) };
  }
  if (version === 6) {
    return { version, address: parseIpv6(normalizedIp) };
  }

  return undefined;
}

function parseIpv4(ip: string): bigint {
  return ip
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .reduce((value, octet) => (value << 8n) + BigInt(octet), 0n);
}

function parseIpv6(ip: string): bigint {
  const [headRaw, tailRaw] = ip.toLowerCase().split("::", 2);
  const head = parseIpv6Hextets(headRaw);
  const tail = tailRaw === undefined ? [] : parseIpv6Hextets(tailRaw);
  const missing = 8 - head.length - tail.length;
  const hextets =
    tailRaw === undefined
      ? head
      : [...head, ...Array.from({ length: missing }, () => 0), ...tail];

  return hextets.reduce(
    (value, hextet) => (value << 16n) + BigInt(hextet),
    0n,
  );
}

function parseIpv6Hextets(raw: string | undefined): number[] {
  if (!raw) {
    return [];
  }

  return raw.split(":").map((part) => Number.parseInt(part, 16));
}
