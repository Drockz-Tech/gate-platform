// src/app/questions/[id]/page.tsx
import QuestionCard from '@/app/components/QuestionCard';

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <QuestionCard questionId={id} />
    </div>
  );
}
