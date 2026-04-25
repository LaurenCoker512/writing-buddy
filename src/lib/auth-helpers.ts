import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export async function authorizeCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.passwordHash) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name ?? null };
}
