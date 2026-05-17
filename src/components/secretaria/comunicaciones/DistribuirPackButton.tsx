import { useState } from 'react';
import { PasoEnvioMiembros } from './PasoEnvioMiembros';

export interface DistribuirPackButtonProps {
  bodyId: string;
  entityId: string;
  meetingId?: string | null;
  meetingDate?: Date | null;
  packStorageUri: string;
  packHash?: string;
}

/**
 * Botón "Distribuir pack a consejeros" para BoardPack page.
 * Abre un modal con PasoEnvioMiembros pre-configurado para PUESTA_DISPOSICION
 * de un Consejo. El attachment va con modo_entrega='LINK_FIRMADO' implícito.
 */
export function DistribuirPackButton(props: DistribuirPackButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] px-4 py-2"
        style={{ borderRadius: 'var(--g-radius-md)' }}
      >
        Distribuir pack a consejeros
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[var(--g-surface-card)] max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
            style={{ borderRadius: 'var(--g-radius-lg)', boxShadow: 'var(--g-shadow-modal)' }}
          >
            <PasoEnvioMiembros
              bodyId={props.bodyId}
              entityId={props.entityId}
              organoTipo="CONSEJO_ADMIN"
              meetingId={props.meetingId ?? null}
              meetingDate={props.meetingDate ?? null}
              documentUri={props.packStorageUri}
              documentHash={props.packHash}
              documentLabel="Board Pack"
              documentMimeType="application/pdf"
              tipoComunicacion="PUESTA_DISPOSICION"
              asunto="Documentación del Consejo"
              cuerpoHtml="<p>Estimado consejero,</p><p>Adjunto la documentación de la próxima sesión del Consejo de Administración para su revisión.</p>"
              onProgramado={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
