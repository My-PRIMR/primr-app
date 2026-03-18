import 'next-auth'

declare module 'next-auth' {
  interface User {
    productRole?: string
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      productRole: string
    }
  }
}
