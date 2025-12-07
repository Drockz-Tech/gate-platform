// src/app/mocks/[id]/page.tsx
import MockTestPage from '@/app/components/MockTestPage';

export default async function MockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MockTestPage mockId={id} />;
}
