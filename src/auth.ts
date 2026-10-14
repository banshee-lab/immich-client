import { authConfig } from "@/auth.config";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials"
import { authenticate } from "@/server/api"
import { z } from 'zod'

declare module "next-auth" {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: DefaultSession["user"] & { userId?: string },
    accessToken?: string;
  }

  interface User {
    accessToken: string;
    userId: string;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuthenticated = Boolean(auth?.accessToken && auth.user?.userId);
      if (nextUrl.pathname === "/login" && isAuthenticated) {
        return Response.redirect(new URL('/album', nextUrl));
      }
      return isAuthenticated
    },
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.userId = user.userId;
      }
      return token;
    },
    async session({session, token}) {
      if (typeof token.accessToken === "string") {
        session.accessToken = token.accessToken;
      }
      if (typeof token.userId === "string") {
        session.user = { ...session.user, userId: token.userId };
      }
      return session;
    }
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().nonempty() })
          .safeParse(credentials)

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data
          const user = await authenticate(email, password)
          if (!user) return null
          return {
            name: user.name,
            id: user.userId,
            userId: user.userId,
            accessToken: user.accessToken,
            email: user.userEmail,
            image: user.profileImagePath,
          }
        }
        return null
      },
    }),
  ],
})