import { randomBytes } from "node:crypto";

/** An unguessable URL-safe token, used for cleaner links and team invite links. */
export const randomToken = (): string => randomBytes(24).toString("base64url");
