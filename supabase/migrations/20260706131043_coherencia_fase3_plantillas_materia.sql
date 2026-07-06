-- Coherencia Secretaría fase 3 (2026-07-03): cierre de plantillas.
-- (1) Enriquecer las 2 ACTIVA cortas v1.1.0 con placeholders dotted (se
--     conservan exactamente sus placeholders); (2) archivar la formulación
--     v1.1.0 duplicada (existe dedicada v1.2.0); (3) alta de materia
--     ACCION_SOCIAL_RESPONSABILIDAD (art. 238 LSC) + binding de la plantilla
--     rica existente. Aplicada en Cloud vía MCP apply_migration (version
--     20260706131043); este archivo es el espejo del repo.
-- Contenido pendiente de revisión del Comité Legal (precedente H1c).

UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{ENTIDAD.denominacion_social}} DE DELEGACIÓN DE FACULTADES

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada ni a la escritura pública de delegación.

PRIMERO.- Delegación. El Consejo de Administración de {{ENTIDAD.denominacion_social}} acuerda delegar las facultades descritas en el Anexo 1 en la figura de {{DELEGACION.modalidad}} (consejero delegado o comisión ejecutiva), al amparo del artículo 249 de la Ley de Sociedades de Capital, con el alcance, límites, régimen de actuación y control que se detallan en dicho anexo.

SEGUNDO.- Mayoría. El acuerdo se adopta con el voto favorable de, al menos, las dos terceras partes de los componentes del Consejo, conforme al artículo 249.2 LSC.

TERCERO.- Facultades indelegables. Quedan expresamente excluidas de la delegación las facultades que el artículo 249 bis LSC declara indelegables (entre otras, la formulación de cuentas, la convocatoria de la Junta, la política de gestión y control de riesgos y las decisiones reservadas por la ley o los estatutos) y, tratándose de sociedad cotizada, las del artículo 529 ter LSC.

CUARTO.- Contrato del consejero delegado. Si la modalidad comprende el nombramiento de consejero delegado o la atribución de funciones ejecutivas en virtud de otro título, se celebrará el contrato exigido por el artículo 249.3 LSC, que deberá aprobarse por la misma mayoría con abstención del consejero afectado y detallar todos los conceptos retributivos conforme al artículo 249.4 LSC.

QUINTO.- Inscripción. La delegación no producirá efecto alguno hasta su inscripción en el Registro Mercantil (artículo 249.2 LSC). Se faculta al Secretario del Consejo, con el visto bueno del Presidente, para expedir certificación y elevar a público este acuerdo a efectos de su inscripción.

Trazabilidad: agreement_id = {{DELEGACION.agreement_id}}. Carácter demo/operativo.$capa1$
WHERE id = 'd3e08b42-a67e-4b33-9bbb-2689b5d8d4cf';

UPDATE plantillas_protegidas SET capa1_inmutable = $capa1$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{ENTIDAD.denominacion_social}} SOBRE OPERACIÓN VINCULADA CON {{OV.parte_vinculada_nombre}}

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada del órgano.

PRIMERO.- Aprobación. El Consejo de Administración de {{ENTIDAD.denominacion_social}}, previa identificación de la parte vinculada {{OV.parte_vinculada_nombre}} y de la naturaleza de la vinculación, aprueba la operación descrita en el Anexo 1, en el marco del deber de lealtad y del régimen de conflictos de interés de los artículos 227 a 230 de la Ley de Sociedades de Capital.

SEGUNDO.- Justificación. La operación se aprueba con justificación del interés social y con referencia al soporte de condiciones de mercado o razonabilidad incorporado al expediente, de modo que la dispensa, cuando proceda, cumpla las condiciones de inocuidad, transparencia y equidad del artículo 230 LSC.

TERCERO.- Abstención. El consejero afectado por el conflicto se abstiene de participar en la deliberación y votación del acuerdo, conforme a los artículos 228.c) y 529 duovicies LSC cuando resulte de aplicación; su abstención y el tratamiento del cómputo se documentan en el anexo de conflictos.

CUARTO.- Régimen de sociedad cotizada. Si la Sociedad es cotizada, la operación se somete al régimen de operaciones vinculadas de los artículos 529 vicies y siguientes LSC: informe previo de la comisión de auditoría, aprobación por el Consejo sin delegación posible cuando la ley lo exige, y publicación o comunicación cuando alcance los umbrales legales.

QUINTO.- Competencia de la Junta. Si el expediente determina que, por su cuantía o naturaleza, la operación es competencia de la Junta General (artículo 529 duovicies.2 LSC o régimen general), este acuerdo se condiciona a dicha aprobación.

SEXTO.- Ejecución. Se faculta al Secretario del Consejo para certificar el acuerdo, custodiar los anexos de operación y conflictos e incorporar la evidencia al expediente.

Trazabilidad: agreement_id = {{OV.agreement_id}}. Carácter demo/operativo.$capa1$
WHERE id = '64fa1683-8cb8-4c4c-b8d6-e09f91cafa59';

-- Formulación v1.1.0 duplicada (existe dedicada v1.2.0 ACTIVA para
-- FORMULACION_CUENTAS): se archiva por trazabilidad, no disponible.
UPDATE plantillas_protegidas SET estado = 'ARCHIVADA'
WHERE id = 'c90edc8c-4655-46b5-a708-31543faadd2e' AND estado = 'ACTIVA';

-- Alta de materia (art. 238 LSC) + binding de la plantilla rica existente.
INSERT INTO materia_catalog (materia, materia_label_es, requires_notary, requires_registry, inscribable, matter_class, min_majority_code, publication_required, plazo_inscripcion_dias, referencia_legal)
VALUES ('ACCION_SOCIAL_RESPONSABILIDAD', 'Acción social de responsabilidad', false, false, false, 'ORDINARIA', 'SIMPLE', false, NULL, 'Arts. 236-241 bis LSC (acuerdo de la Junta, art. 238 LSC)')
ON CONFLICT (materia) DO NOTHING;

UPDATE plantillas_protegidas SET materia_acuerdo = 'ACCION_SOCIAL_RESPONSABILIDAD'
WHERE id = 'f698a2f2-aa22-41dc-9063-f64a2f0b6219' AND materia_acuerdo IS NULL;
