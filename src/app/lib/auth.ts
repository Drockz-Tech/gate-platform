// lib/auth.ts
//
// Central auth helper for server-side code.
// All APIs should use ONLY these helpers to access the current user.
// This makes it easy to swap auth providers later (NextAuth, Clerk, custom JWT, etc.)
// without touching your route handlers / services.

import { headers } from 'next/headers';

export type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  // you can extend this later (role, avatar, etc.)
};

/**
 * getCurrentUser()
 *
 * Server-side helper to fetch the authenticated user.
 * For now: development-friendly stub using headers.
 *
 * Later, you can replace the internals with NextAuth or any other system:
 *
 * Example with NextAuth:
 * ---------------------------------
 * import { getServerSession } from 'next-auth';
 * import { authOptions } from '@/lib/auth-options';
 *
 * export async function getCurrentUser(): Promise<AuthUser | null> {
 *   const session = await getServerSession(authOptions);
 *   if (!session?.user?.id) return null;
 *   return {
 *     id: session.user.id,
 *     email: session.user.email,
 *     name: session.user.name,
 *   };
 * }
 * ---------------------------------
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const h = await headers();

  // 🔹 Dev-only header-based auth:
  // You can send `x-user-id`, `x-user-email`, `x-user-name`
  // from Postman / Thunder / frontend fetch during early development.
  const id = h.get('x-user-id');

  if (!id) {
    return null;
  }

  const email = h.get('x-user-email');
  const name = h.get('x-user-name');

  return {
    id,
    email,
    name,
  };
}

/**
 * getCurrentUserId()
 *
 * Convenience wrapper to just get user id (most common case in APIs).
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * requireUser()
 *
 * Helper for places where user MUST be logged in.
 * Throwing an error lets you centralize how unauthorized is handled.
 * In API routes you can catch and convert to 401 JSON response.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

/**
 * requireUserId()
 *
 * Same as requireUser but returns only the id.
 */
export async function requireUserId(): Promise<string> {
  const user = await requireUser();
  return user.id;
}
