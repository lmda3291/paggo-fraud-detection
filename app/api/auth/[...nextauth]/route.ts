import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          credentials?.email === "analyst@paggo.com" &&
          credentials?.password === "paggo2025"
        ) {
          return {
            id: "1",
            name: "Fraud Analyst",
            email: "analyst@paggo.com",
          };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "paggo-fraud-detection-secret-2025",
});

export { handler as GET, handler as POST };
