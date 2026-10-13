export function ProsePage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl py-4 [overflow-wrap:anywhere]">
      <h1 className="mb-4 text-2xl font-extrabold text-[var(--sb-ink)]">{title}</h1>
      <div className="space-y-4 text-[15px] leading-relaxed text-[var(--sb-text-secondary)] [&_h2]:mt-7 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[var(--sb-ink)] [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5 [&_li]:mt-2 [&_a]:text-[var(--sb-action)] [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </div>
    </article>
  );
}
