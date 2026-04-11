import { db } from '@/db'
import { users } from '@/db/schema'
import { getStripe } from '@/stripe'
import { eq } from 'drizzle-orm'

export async function ensureStripeCustomer(
  userId: string,
  email: string,
  name: string | null,
): Promise<string> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (user?.stripeCustomerId) return user.stripeCustomerId

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { primrUserId: userId },
  })

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(users.id, userId))

  return customer.id
}

export async function downgradeUserToFree(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ plan: 'free' })
    .where(eq(users.id, userId))
}

export async function downgradeOrganization(organizationId: string): Promise<void> {
  await db
    .update(users)
    .set({ plan: 'free' })
    .where(eq(users.organizationId, organizationId))
}
