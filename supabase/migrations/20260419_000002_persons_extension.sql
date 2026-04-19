-- Motor de Reglas LSC: extension de personas y mandatos para computo de capital y representacion (art. 212 bis, 184, 189 LSC)

-- Extend persons table with legal entity tracking
ALTER TABLE persons ADD COLUMN IF NOT EXISTS person_type TEXT NOT NULL DEFAULT 'NATURAL' CHECK (person_type IN ('NATURAL', 'JURIDICA'));
ALTER TABLE persons ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS representative_person_id UUID REFERENCES persons(id);
ALTER TABLE persons ADD COLUMN IF NOT EXISTS denomination TEXT;

-- Extend mandates table with capital and voting information
ALTER TABLE mandates ADD COLUMN IF NOT EXISTS capital_participacion NUMERIC;
ALTER TABLE mandates ADD COLUMN IF NOT EXISTS porcentaje_capital NUMERIC;
ALTER TABLE mandates ADD COLUMN IF NOT EXISTS tiene_derecho_voto BOOLEAN DEFAULT true;
ALTER TABLE mandates ADD COLUMN IF NOT EXISTS clase_accion TEXT;
ALTER TABLE mandates ADD COLUMN IF NOT EXISTS representative_person_id UUID REFERENCES persons(id);

-- Extend meeting_attendees table with quorum capital tracking
ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS capital_representado NUMERIC;
ALTER TABLE meeting_attendees ADD COLUMN IF NOT EXISTS via_representante BOOLEAN DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_persons_person_type ON persons(person_type);
CREATE INDEX IF NOT EXISTS idx_persons_tax_id ON persons(tax_id);
CREATE INDEX IF NOT EXISTS idx_persons_representative ON persons(representative_person_id);
CREATE INDEX IF NOT EXISTS idx_mandates_capital ON mandates(porcentaje_capital);
CREATE INDEX IF NOT EXISTS idx_mandates_voto ON mandates(tiene_derecho_voto);
CREATE INDEX IF NOT EXISTS idx_mandates_representative ON mandates(representative_person_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_capital ON meeting_attendees(capital_representado);
