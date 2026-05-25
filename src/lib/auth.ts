import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./db"

const providers = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      // For prototype: simple email-based login (no password check)
      // In production, use proper password hashing with bcrypt
      const user = await prisma.user.findUnique({
        where: { email: credentials.email as string },
      })
      if (!user) {
        // Auto-create user for prototype
        return prisma.user.create({
          data: { email: credentials.email as string, name: (credentials.email as string).split("@")[0] },
        })
      }
      return user
    },
  }),
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
})
