import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { NextApiRequest, NextApiResponse } from 'next'
import NextAuth from 'next-auth'
import Adapters from 'next-auth/adapters'
import Providers from 'next-auth/providers'

import Session from '@/types/session'
import Token from '@/types/token'
import User from '@/types/user'

const jwtSecret = JSON.parse(process.env.AUTH_PRIVATE_KEY || ``)

const prisma = new PrismaClient()

const options = {
  providers: [
    Providers.Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  database: process.env.DATABASE_URL,
  // @ts-ignore
  adapter: Adapters.Prisma.Adapter({ prisma }),
  session: {
    jwt: true,
  },
  jwt: {
    encode: async ({ token, secret }: { token: Token; secret: string }) => {
      const tokenContents = {
        id: `${token.id}`,
        name: token.name,
        email: token.email,
        picture: token.picture,
        'https://hasura.io/jwt/claims': {
          'x-hasura-allowed-roles': ['admin', 'user'],
          'x-hasura-default-role': 'user',
          'x-hasura-role': 'user',
          'x-hasura-user-id': `${token.id}`,
        },
        iat: Date.now() / 1000,
        exp: Math.floor(Date.now() / 1000) + 72 * 60 * 60,
        sub: `${token.id}`,
      }

      const encodedToken = jwt.sign(tokenContents, jwtSecret.key, {
        algorithm: jwtSecret.type,
      })

      return encodedToken
    },
    decode: async ({ token, secret }: { token: string; secret: string }) => {
      const decodedToken = jwt.verify(token, jwtSecret.key, {
        algorithms: jwtSecret.type,
      })

      return decodedToken
    },
  },
  debug: true,
  callbacks: {
    session: async (session: Session, user: User) => {
      const encodedToken = jwt.sign(user, jwtSecret.key, {
        algorithm: jwtSecret.type,
      })

      session.id = user.id
      session.token = encodedToken

      return Promise.resolve(session)
    },
    jwt: async (
      token: Token,
      user: User,
      account: any,
      profile: any,
      isNewUser: any,
    ) => {
      const isSignIn = user ? true : false

      if (isSignIn) {
        token.id = user.id
      }

      return Promise.resolve(token)
    },
  },
}

const Auth = (req: NextApiRequest, res: NextApiResponse) =>
  // @ts-ignore
  NextAuth(req, res, options)

export default Auth
