import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { computeSha512 } from "@/lib/doc-gen/storage-archiver";

/**
 * Evidencia probatoria de las medidas del autodiagnóstico.
 *
 * QUÉ ACREDITA Y QUÉ NO — se dice aquí porque es lo que la pantalla puede
 * afirmar: el hash SHA-512 se calcula en el NAVEGADOR con Web Crypto y se
 * guarda con el registro. Prueba que el fichero no ha cambiado desde que se
 * registró. **No prueba fecha cierta, ni identidad, ni integridad contextual**;
 * para eso harían falta un sello de tiempo cualificado y archivo cualificado,
 * que no están integrados. Por eso la postura probatoria es `REFERENCE` y la
 * base de datos no admite otra.
 */

export const BUCKET_EVIDENCIAS = "aims-evidence";

/** Lo único que el piloto puede afirmar. La base de datos no admite más. */
export const POSTURA_PROBATORIA = "REFERENCE";

export const AVISO_HASH_CLIENTE =
  "Huella SHA-512 calculada en el navegador: acredita que el fichero no ha cambiado desde que se registró. No acredita fecha cierta ni identidad del firmante.";

export type EvidenceLink = { tipo: "MEDIDA" | "SECCION" | "INCIDENTE"; ref: string };

export type AimsEvidenceItem = {
  id: string;
  tenant_id: string;
  system_id: string;
  kind: string;
  title: string;
  storage_path: string | null;
  external_ref: string | null;
  content_hash: string | null;
  hash_algorithm: string;
  hash_computed_in: string;
  document_date: string | null;
  expires_on: string | null;
  uploaded_by: string | null;
  evidentiary_posture: string;
  links: EvidenceLink[];
  created_at: string;
};

export function useEvidenceBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_evidence_items", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("aims_evidence_items")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("system_id", systemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AimsEvidenceItem[];
    } : skipToken,
  });
}

/** ¿Está caducada? Una ISO o un SOC 2 valen un año y hay que notarlo. */
export function evidenciaCaducada(e: Pick<AimsEvidenceItem, "expires_on">, hoy = new Date()): boolean {
  if (!e.expires_on) return false;
  const t = Date.parse(e.expires_on);
  return !Number.isNaN(t) && t < hoy.setHours(0, 0, 0, 0);
}

/** Las evidencias VIGENTES atadas a cada código de medida. */
export function evidenciasPorMedida(
  items: AimsEvidenceItem[] | undefined,
  hoy = new Date(),
): Record<string, AimsEvidenceItem[]> {
  const out: Record<string, AimsEvidenceItem[]> = {};
  (items ?? []).forEach((e) => {
    if (evidenciaCaducada(e, new Date(hoy))) return;
    (e.links ?? [])
      .filter((l) => l?.tipo === "MEDIDA" && l.ref)
      .forEach((l) => {
        out[l.ref] = [...(out[l.ref] ?? []), e];
      });
  });
  return out;
}

export function useRegistrarEvidencia() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      systemId: string;
      kind: string;
      title: string;
      file?: File | null;
      externalRef?: string | null;
      documentDate?: string | null;
      expiresOn?: string | null;
      links: EvidenceLink[];
    }) => {
      if (!input.file && !input.externalRef?.trim()) {
        throw new Error("Aporta un fichero o una referencia externa.");
      }

      let storagePath: string | null = null;
      let contentHash: string | null = null;

      if (input.file) {
        const buffer = await input.file.arrayBuffer();
        contentHash = await computeSha512(buffer);
        // El PRIMER segmento es el tenant y la política de storage lo
        // comprueba. La convención se impone desde el primer objeto: el bucket
        // nace vacío, así que no hay histórico que resolver «por la ruta» como
        // en `matter-documents`.
        const limpio = input.file.name.replace(/[^\w.-]+/g, "_").slice(-120);
        storagePath = `${tenantId}/${input.systemId}/${contentHash.slice(0, 16)}-${limpio}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET_EVIDENCIAS)
          .upload(storagePath, input.file, { upsert: false, contentType: input.file.type || undefined });
        if (upErr) throw upErr;
      }

      const { data: sesion } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("aims_evidence_items")
        .insert({
          tenant_id: tenantId!,
          system_id: input.systemId,
          kind: input.kind,
          title: input.title.trim(),
          storage_path: storagePath,
          external_ref: input.externalRef?.trim() || null,
          content_hash: contentHash,
          document_date: input.documentDate || null,
          expires_on: input.expiresOn || null,
          uploaded_by: sesion?.user?.id ?? null,
          evidentiary_posture: POSTURA_PROBATORIA,
          links: input.links,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AimsEvidenceItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aims_evidence_items"] }),
  });
}

/**
 * Ata una evidencia ya registrada a otra medida SIN duplicar el fichero: un
 * informe SOC 2 del proveedor sirve a la vez para seguridad, gobernanza y
 * gestión de proveedor.
 *
 * El trigger de la tabla sólo deja tocar vínculos y caducidad; el hash, la ruta
 * y el título están congelados.
 */
export function useVincularEvidencia() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, links }: { id: string; links: EvidenceLink[] }) => {
      const { data, error } = await supabase
        .from("aims_evidence_items")
        .update({ links })
        .eq("tenant_id", tenantId!)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      // La RLS filtra una escritura ajena a cero filas SIN error: sin esto, un
      // vínculo que no se ha guardado se daría por guardado.
      if (!data) throw new Error("No se pudo vincular: la evidencia no es de este entorno.");
      return data as AimsEvidenceItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aims_evidence_items"] }),
  });
}

/** URL firmada de corta duración. Nunca pública: el bucket es privado. */
export async function urlFirmadaDeEvidencia(storagePath: string, segundos = 900): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .createSignedUrl(storagePath, segundos);
  if (error) throw error;
  return data.signedUrl;
}
