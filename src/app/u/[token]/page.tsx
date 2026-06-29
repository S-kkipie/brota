import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getProfileData } from "@/lib/savings";
import ProfileView from "@/components/ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await db.query.users.findFirst({
    where: eq(users.webToken, token),
  });
  if (!user) notFound();

  const data = await getProfileData(user);
  return <ProfileView data={data} />;
}
