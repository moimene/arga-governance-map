import { BPSection } from "./BPSection";
import { BoardPackMeeting } from "@/hooks/useBoardPackData";

interface BPAgendaProps {
  items: BoardPackMeeting["agenda_items"];
}

export function BPAgenda({ items }: BPAgendaProps) {
  if (items.length === 0) {
    return (
      <BPSection title="2. Agenda de la sesión">
        <p className="text-sm text-[var(--g-text-secondary)]">Sin puntos de agenda registrados.</p>
      </BPSection>
    );
  }

  return (
    <BPSection title="2. Agenda de la sesión">
      <ol className="space-y-2">
        {items.map((item) => (
          <li
            key={item.order_number}
            className="flex gap-3 border-b border-[var(--g-border-subtle)] pb-3 last:border-0 last:pb-0"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold text-[var(--g-text-inverse)]"
              style={{ backgroundColor: "var(--g-brand-3308)", borderRadius: "var(--g-radius-full)" }}
            >
              {item.order_number}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--g-text-primary)]">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">{item.description}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </BPSection>
  );
}
