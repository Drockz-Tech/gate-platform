export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">
        GATE CSE Question Bank
      </h1>
      <p className="text-sm text-gray-600">
        Start exploring questions or create mocks.
      </p>
      <div className="flex gap-3 text-sm">
        <a
          href="/questions"
          className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Browse Questions
        </a>
        <a
          href="/admin/questions/new"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-medium text-gray-800 hover:bg-gray-50"
        >
          Admin: Add Question
        </a>
      </div>
    </main>
  );
}
