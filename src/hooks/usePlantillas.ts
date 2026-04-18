import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlantillaRow {
  id: string;
  tenant_id: string;
  template_code: string;
  title: string;
  typology: string | null;
  body_type: string[] | null;
  content_template: string | null;
  version: string;
  locale: string;
  is_active: boolean;
}

export function usePlantillasList() {
  return useQuery({
    queryKey: ["document_templates", "list"],
    queryFn: async (): Promise<PlantillaRow[]> => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .order("template_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlantillaRow[];
    },
  });
}
