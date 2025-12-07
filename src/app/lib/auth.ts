// src/lib/auth.ts
//
// SUPER SIMPLE dummy auth for local dev.
// Everything runs as if there is a single logged-in user.

export async function requireUserId(): Promise<string> {
  // Always return the same fake user id
  return 'demo-user-1';
}

// Used in user-facing APIs (questions list, attempts, bookmarks, etc.)
export async function getCurrentUserId(): Promise<string | null> {
  // Always "logged in"
  return 'demo-user-1';
}

// Used in admin APIs. For now, no real role-check.
export async function requireAdminUserId(): Promise<string> {
  return 'demo-user-1';
}
