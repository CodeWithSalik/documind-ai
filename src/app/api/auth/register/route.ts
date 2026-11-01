import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const result = registerSchema.safeParse(json);

    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: issues || "Invalid input data",
          },
        },
        { status: 400 }
      );
    }

    const { name, email, password } = result.data;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_EXISTS",
            message: "An account with this email already exists. Please sign in instead.",
          },
        },
        { status: 409 }
      );
    }

    // Hash password with bcrypt salt factor 12
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user and initial default workspace in a transaction
    const { user: newUser, workspace: newWorkspace } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      const slug = `workspace-${user.id.slice(0, 8)}-${Date.now().toString(36)}`;
      const workspace = await tx.workspace.create({
        data: {
          name: `${name}'s Workspace`,
          slug,
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });

      return { user, workspace };
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
        workspace: {
          id: newWorkspace.id,
          name: newWorkspace.name,
          slug: newWorkspace.slug,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred during registration. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
