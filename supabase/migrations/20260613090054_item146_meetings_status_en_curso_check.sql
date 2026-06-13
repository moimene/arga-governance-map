-- ITEM-146: estado intermedio EN_CURSO para reuniones.
--
-- "Declarar apertura" ponía meetings.status='CELEBRADA' antes de celebrarse la
-- sesión, distorsionando KPIs y el lenguaje de estado (una sesión abierta y
-- abandonada quedaba "Celebrada" sin asistentes/quórum/acta). Se introduce
-- EN_CURSO como estado de sesión abierta; CELEBRADA se reserva para el cierre
-- (generación de acta). State machine resultante:
--   DRAFT → CONVOCADA → EN_CURSO → CELEBRADA  (rama normal)
--                    ↘ CANCELADA
--
-- Forward-only: añade el valor al CHECK sin tocar las 16 filas CELEBRADA
-- existentes (mezcla de celebradas reales; no se reclasifican retroactivamente).

ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;

ALTER TABLE meetings ADD CONSTRAINT meetings_status_check
  CHECK (status IN ('DRAFT', 'CONVOCADA', 'EN_CURSO', 'CELEBRADA', 'CANCELADA'));
