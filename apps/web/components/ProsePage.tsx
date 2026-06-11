export function ProsePage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="card mx-auto max-w-3xl p-8">
      <h1 className="mb-4 text-2xl font-extrabold text-emerald-800">{title}</h1>
      <div className="space-y-3 text-[15px] leading-relaxed text-stone-700 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
        {children}
      </div>
    </article>
  );
}
