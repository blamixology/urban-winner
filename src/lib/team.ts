export function inviteLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}
