import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        try {
          const user = await db.user.findUnique({ where: { email } });

          if (!user || !user.password) {
            return null;
          }

          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        } catch (dbError) {
          console.error("Database connection error during authorization:", dbError);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = token.sub;
        if (token.workspaceId) {
          (session.user as unknown as { workspaceId?: string }).workspaceId = token.workspaceId as string;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        try {
          const ws = await db.workspace.findFirst({
            where: {
              OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
            },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          });
          if (ws) {
            token.workspaceId = ws.id;
          }
        } catch {
          // Ignore lookup errors in JWT callback
        }
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
});
