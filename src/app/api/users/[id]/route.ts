import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { canManageUsers, roleFromSession } from "@/lib/permissions";

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["viewer", "sales", "editor", "admin"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const actorId = (session?.user as any)?.id;
  if (!canManageUsers(roleFromSession(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Self-protection: an admin cannot change their own role or deactivate themselves.
  // Prevents accidental self-lockout.
  if (id === actorId) {
    if (parsed.data.role !== undefined && parsed.data.role !== target.role) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }
    if (parsed.data.active === false) {
      return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
    }
  }

  // Peer-protection: an admin cannot demote or deactivate another admin.
  // Demoting/removing an admin peer must go through direct DB access, not the UI —
  // this prevents one admin from unilaterally stripping another admin's access.
  if (target.role === "admin" && id !== actorId) {
    if (parsed.data.role !== undefined && parsed.data.role !== "admin") {
      return NextResponse.json(
        { error: "Cannot demote another admin. Use direct database access if intentional." },
        { status: 400 }
      );
    }
    if (parsed.data.active === false) {
      return NextResponse.json(
        { error: "Cannot deactivate another admin. Use direct database access if intentional." },
        { status: 400 }
      );
    }
  }

  // Last-admin protection: the system must always retain at least one active admin.
  const demotingOrDeactivatingAdmin =
    target.role === "admin" &&
    ((parsed.data.role !== undefined && parsed.data.role !== "admin") ||
      parsed.data.active === false);
  if (demotingOrDeactivatingAdmin) {
    const activeAdminCount = await prisma.user.count({
      where: { role: "admin", active: true },
    });
    if (activeAdminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last active admin" },
        { status: 400 }
      );
    }
  }

  const data: any = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json(user);
}
