/**
 * SMS via SMSO.ro (https://api-docs.smso.ro/): POST /api/v1/send with an
 * X-Authorization API key and form fields sender/to/body. No-ops (and logs)
 * when SMSO_API_KEY / SMSO_SENDER aren't set, so dev and CI don't need them.
 */
export function smsConfigured(): boolean {
  return Boolean(process.env.SMSO_API_KEY && process.env.SMSO_SENDER);
}

/** Local Romanian mobile numbers (07xxxxxxxx) → E.164 (+407xxxxxxxx). Leaves already-international numbers as-is. */
export function toE164Ro(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+4${digits}`;
  if (digits.startsWith("40")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendSms(phone: string, body: string): Promise<boolean> {
  if (!smsConfigured()) {
    console.log(`[sms:noop] ${phone}: ${body}`);
    return false;
  }
  const to = toE164Ro(phone);
  try {
    const res = await fetch("https://app.smso.ro/api/v1/send", {
      method: "POST",
      headers: { "X-Authorization": process.env.SMSO_API_KEY!, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ sender: process.env.SMSO_SENDER!, to, body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[sms] SMSO ${res.status} for ${to}: ${await res.text().catch(() => "")}`);
      return false;
    }
    const json = (await res.json().catch(() => null)) as { status?: string } | null;
    if (json?.status && json.status !== "success" && json.status !== "ok") {
      console.error(`[sms] SMSO rejected message to ${to}: ${JSON.stringify(json)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[sms] SMSO request failed for ${to}: ${err}`);
    return false;
  }
}
