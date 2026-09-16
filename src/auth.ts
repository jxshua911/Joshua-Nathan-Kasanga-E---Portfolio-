import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

export function isAuthorised(req: IncomingMessage, expectedToken: string | undefined): boolean {
  if (!expectedToken) return false;
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
