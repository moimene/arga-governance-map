-- B1 v3 (commit 5d8f7a9) descubrió que agreements.adoption_mode CHECK
-- constraint no aceptaba SOLIDARIO/CO_APROBACION pese a que el motor
-- TS y los steppers (SolidarioStepper, CoAprobacionStepper) intentan
-- persistir esos valores. Sprint G amplió los TS types pero la
-- migración del CHECK nunca se aplicó. Sin esto, los stepers de
-- producción rompen contra BD.
--
-- Esta migración alinea el CHECK con la enumeración real del motor.
-- Reversible: la migración inversa restaura el conjunto previo de 5 valores.

ALTER TABLE agreements DROP CONSTRAINT IF EXISTS agreements_adoption_mode_check;

ALTER TABLE agreements ADD CONSTRAINT agreements_adoption_mode_check
  CHECK (adoption_mode IN (
    'MEETING',
    'UNIVERSAL',
    'NO_SESSION',
    'UNIPERSONAL_SOCIO',
    'UNIPERSONAL_ADMIN',
    'SOLIDARIO',
    'CO_APROBACION'
  ));

COMMENT ON CONSTRAINT agreements_adoption_mode_check ON agreements IS
  'Enumeración alineada con AdoptionMode del motor V2 (Sprint G). Permite todos los modes: MEETING, UNIVERSAL, NO_SESSION, UNIPERSONAL_SOCIO, UNIPERSONAL_ADMIN, SOLIDARIO, CO_APROBACION.';
