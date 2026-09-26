import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema as s } from "@/lib/db";
import { currentUserId } from "@/lib/auth";
import { readPhoto } from "@/lib/photos";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [photo] = await db
    .select({ path: s.photos.path, ownerId: s.properties.ownerId, cleanerToken: s.cleaners.token })
    .from(s.photos)
    .innerJoin(s.turnovers, eq(s.photos.turnoverId, s.turnovers.id))
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .leftJoin(s.cleaners, eq(s.turnovers.cleanerId, s.cleaners.id))
    .where(eq(s.photos.id, id));
  if (!photo) return new NextResponse("Not found", { status: 404 });

  const token = req.nextUrl.searchParams.get("t");
  const isCleaner = !!token && photo.cleanerToken === token;
  const isOwner = !isCleaner && (await currentUserId()) === photo.ownerId;
  if (!isCleaner && !isOwner) return new NextResponse("Not found", { status: 404 });

  const { data, type } = await readPhoto(photo.path);
  return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=86400" } });
}
