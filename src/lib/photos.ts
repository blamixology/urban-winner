import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const ROOT = () => path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export async function savePhoto(turnoverId: string, file: File): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new Error("Unsupported image type");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Image too large");
  const rel = path.join(turnoverId, `${randomUUID()}.${ext}`);
  await mkdir(path.join(ROOT(), turnoverId), { recursive: true });
  await writeFile(path.join(ROOT(), rel), Buffer.from(await file.arrayBuffer()));
  return rel;
}

export async function readPhoto(rel: string): Promise<{ data: Buffer; type: string }> {
  const full = path.resolve(ROOT(), rel);
  if (!full.startsWith(ROOT() + path.sep)) throw new Error("Bad path");
  const ext = path.extname(full).slice(1);
  const type = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  return { data: await readFile(full), type };
}
