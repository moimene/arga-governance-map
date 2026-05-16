ALTER TABLE entities ADD COLUMN IF NOT EXISTS es_cotizada boolean DEFAULT false;

-- ARGA Seguros S.A. es la entidad cotizada del grupo (IBEX 35)
UPDATE entities
SET es_cotizada = true
WHERE common_name ILIKE '%ARGA Seguros%'
   OR legal_name ILIKE '%ARGA Seguros%';
