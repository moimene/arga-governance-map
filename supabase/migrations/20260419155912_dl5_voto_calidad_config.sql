-- DL-5: Voto de calidad del presidente — config per órgano
ALTER TABLE governing_bodies ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- CdA: voto calidad SÍ
UPDATE governing_bodies SET config = '{"voto_calidad_presidente": true}'::jsonb
WHERE id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59';

-- Comité Ejecutivo: voto calidad SÍ + es_comite_ejecutivo
UPDATE governing_bodies SET config = '{"voto_calidad_presidente": true, "es_comite_ejecutivo": true}'::jsonb
WHERE id = '4d9e6026-c5ef-411b-949b-78d720f4da37';

-- Comisión de Auditoría: voto calidad NO
UPDATE governing_bodies SET config = '{"voto_calidad_presidente": false}'::jsonb
WHERE id = 'd1b57c91-3698-4630-bb5c-e8c765049c6c';

-- Comisión de Riesgos Regulada: voto calidad NO
UPDATE governing_bodies SET config = '{"voto_calidad_presidente": false}'::jsonb
WHERE id = '796f6fc3-0f34-4da8-9619-b3480c827298';

-- Comisión de Nombramientos: voto calidad NO
UPDATE governing_bodies SET config = '{"voto_calidad_presidente": false}'::jsonb
WHERE id = '5b3f5a61-ada8-41ee-90dd-fbe62d72ef67';

-- Comisión de Retribuciones: voto calidad NO
UPDATE governing_bodies SET config = '{"voto_calidad_presidente": false}'::jsonb
WHERE id = 'fad9e127-af82-4336-9255-610644dd401b';

-- Comisión de Sostenibilidad: voto calidad NO
UPDATE governing_bodies SET config = '{"voto_calidad_presidente": false}'::jsonb
WHERE id = '31cd5074-0941-4101-8e4c-01ea62eed6dc';
