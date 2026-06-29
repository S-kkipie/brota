import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, positions } from "@/db/schema";
import type { User } from "@/db/schema";
import { optionalEnv } from "@/lib/env";
import { getProfileData } from "@/lib/savings";
import ProfileView from "@/components/ProfileView";

export const dynamic = "force-dynamic";

/** Pick the profile the public demo showcases: DEMO_WEB_TOKEN, else first user with a position, else first user. */
async function resolveShowcaseUser(): Promise<User | undefined> {
  const token = optionalEnv("DEMO_WEB_TOKEN");
  if (token) {
    const byToken = await db.query.users.findFirst({ where: eq(users.webToken, token) });
    if (byToken) return byToken;
  }
  const withPosition = await db.query.positions.findFirst();
  if (withPosition) {
    const owner = await db.query.users.findFirst({ where: eq(users.id, withPosition.userId) });
    if (owner) return owner;
  }
  return db.query.users.findFirst();
}

export default async function DemoPage() {
  const user = await resolveShowcaseUser();
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center font-sans text-slate-50">
        <div>
          <p className="mb-4 text-lg text-slate-400">Aún no hay ahorristas.</p>
          <p className="text-sm">
            Escribe al bot de WhatsApp o Telegram para empezar a generar datos reales.
          </p>
        </div>
      </div>
    );
  }

  const data = await getProfileData(user);
  return <ProfileView data={data} />;
}
