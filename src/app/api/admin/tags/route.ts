// app/api/admin/tags/route.ts
//
// Admin APIs for managing tags.
//
// GET /api/admin/tags
//   → List all tags.
//
// POST /api/admin/tags
//   Body:
//     {
//       "id": "optional-tag-id-if-updating",
//       "name": "High Weightage",
//       "slug": "high-weightage" // optional, auto-generated if missing
//     }
//
//   Behaviour:
//     - If "id" provided → update that tag.
//     - Else → create new tag (slug must be unique).
//
//   Returns:
//     { data: Tag[] } for GET
//     { data: Tag } for POST

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { requireUserId } from '@/app/lib/auth';

// Simple admin guard
async function requireAdminUserId(): Promise<string> {
  const userId = await requireUserId();
  // TODO: check role later
  return userId;
}

type TagBody = {
  id?: string;
  name?: string;
  slug?: string;
};

/* ------------------------ helper: slugify ------------------------ */

function slugify(input: string): string {
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '');    // trim dashes
}

/* ------------------------ GET: list tags ------------------------- */

export async function GET(_req: NextRequest) {
  try {
    await requireAdminUserId();

    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: tags });
  } catch (err) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/admin/tags error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/* ------------------------ POST: create/update tag ---------------- */

export async function POST(req: NextRequest) {
  try {
    await requireAdminUserId();

    let body: TagBody;
    try {
      body = (await req.json()) as TagBody;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const id = body.id?.toString().trim();
    const name = body.name?.toString().trim();
    let slug = body.slug?.toString().trim();

    if (!name) {
      return NextResponse.json(
        { error: '"name" is required' },
        { status: 400 },
      );
    }

    if (!slug) {
      slug = slugify(name);
    } else {
      slug = slugify(slug); // normalize
    }

    let tag;

    if (id) {
      // Update existing tag
      tag = await prisma.tag.update({
        where: { id },
        data: {
          name,
          slug,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      // Create new tag (slug has UNIQUE constraint)
      tag = await prisma.tag.create({
        data: {
          name,
          slug,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return NextResponse.json({ data: tag });
  } catch (err: any) {
    if ((err as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle unique slug violation gracefully
    if (err.code === 'P2002') {
      // Prisma unique constraint error
      return NextResponse.json(
        { error: 'Tag slug already exists. Please use a different name/slug.' },
        { status: 400 },
      );
    }

    console.error('POST /api/admin/tags error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
