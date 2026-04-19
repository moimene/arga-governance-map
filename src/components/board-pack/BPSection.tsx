import { ReactNode } from "react";

interface BPSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function BPSection({ title, children, className = "" }: BPSectionProps) {
  return (
    <section className={`mt-8 pt-6 border-t-2 border-[var(--g-brand-3308)] ${className}`}>
      <h2
        className="mb-4 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-[var(--g-text-inverse)]"
        style={{ backgroundColor: "var(--g-brand-3308)", borderRadius: "var(--g-radius-sm)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
