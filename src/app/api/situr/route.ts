import { NextResponse, type NextRequest } from "next/server";
import { currentOrganizationId } from "@/lib/auth";
import { occupancyReport } from "@/lib/situr";

const csv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export async function GET(req: NextRequest) {
  const organizationId = await currentOrganizationId();
  if (!organizationId) return new NextResponse("Unauthorized", { status: 401 });
  const { month, occupancy } = await occupancyReport(organizationId, req.nextUrl.searchParams.get("month") ?? undefined);
  const lines = [
    ["proprietate", "cod_situr", "sosire", "plecare", "nopti", "nume_oaspete", "ci_pasaport", "nr_persoane"].join(","),
    ...occupancy.map((o) => [o.propertyName, o.siturCode ?? "", o.arrival, o.departure, o.nights, o.guestName ?? "", o.guestIdDoc ?? "", o.guestCount].map(csv).join(",")),
  ];
  return new NextResponse("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ocupare-${month}.csv"`,
    },
  });
}
