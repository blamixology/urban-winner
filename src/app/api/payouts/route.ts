import { NextResponse, type NextRequest } from "next/server";
import { currentUserId } from "@/lib/auth";
import { payouts } from "@/lib/payouts";
import { dayInTz } from "@/lib/time";

const csv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const { month, done } = await payouts(userId, req.nextUrl.searchParams.get("month") ?? undefined);
  const lines = [
    ["data", "proprietate", "persoana", "tarif_lei"].join(","),
    ...done.map((t) => [dayInTz(t.completedAt!), t.propertyName, t.cleanerName ?? "", t.feeRon].map(csv).join(",")),
  ];
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="decont-${month}.csv"`,
    },
  });
}
