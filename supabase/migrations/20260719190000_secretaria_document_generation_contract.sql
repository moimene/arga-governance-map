-- Cierra el contrato Capa 2/Capa 3 detectado durante la prueba E2E del
-- expediente de Consejo. La plantilla legacy de delegación declaraba dos
-- variables USUARIO, pero el formulario exponía claves distintas y el texto
-- ni siquiera incorporaba el anexo de facultades. El composer ya bloquea
-- cualquier variable del cuerpo sin resolver; esta migración devuelve la
-- plantilla activa a un estado operable y trazable.

DO $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.plantillas_protegidas
  SET
    version = '1.1.1',
    capa1_inmutable = $template$ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{ENTIDAD.denominacion_social}} DE DELEGACIÓN DE FACULTADES

Este documento se emite como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva ni sustituye al acta formal aprobada ni a la escritura pública de delegación.

PRIMERO.- Delegación. El Consejo de Administración de {{ENTIDAD.denominacion_social}} acuerda delegar las facultades descritas en el Anexo 1 en la figura de {{DELEGACION.modalidad}}, al amparo del artículo 249 de la Ley de Sociedades de Capital, con el alcance, límites, régimen de actuación y control que se detallan en dicho anexo.

SEGUNDO.- Mayoría. El acuerdo se adopta con el voto favorable de, al menos, las dos terceras partes de los componentes del Consejo, conforme al artículo 249.2 LSC.

TERCERO.- Facultades indelegables. Quedan expresamente excluidas de la delegación las facultades que el artículo 249 bis LSC declara indelegables (entre otras, la formulación de cuentas, la convocatoria de la Junta, la política de gestión y control de riesgos y las decisiones reservadas por la ley o los estatutos) y, tratándose de sociedad cotizada, las del artículo 529 ter LSC.

CUARTO.- Contrato del consejero delegado. Si la modalidad comprende el nombramiento de consejero delegado o la atribución de funciones ejecutivas en virtud de otro título, se celebrará el contrato exigido por el artículo 249.3 LSC, que deberá aprobarse por la misma mayoría con abstención del consejero afectado y detallar todos los conceptos retributivos conforme al artículo 249.4 LSC.

QUINTO.- Inscripción. La delegación no producirá efecto alguno hasta su inscripción en el Registro Mercantil (artículo 249.2 LSC). Se faculta al Secretario del Consejo, con el visto bueno del Presidente, para expedir certificación y elevar a público este acuerdo a efectos de su inscripción.

SEXTO.- Constancia de constitución y mayoría. {{DELEGACION.quorum_reforzado}}

ANEXO 1.- ALCANCE Y LÍMITES DE LAS FACULTADES DELEGADAS
{{DELEGACION.facultades_texto}}

Trazabilidad: agreement_id = {{DELEGACION.agreement_id}}. Carácter demo/operativo.$template$,
    capa2_variables = jsonb_build_array(
      jsonb_build_object(
        'variable', 'DELEGACION.modalidad',
        'fuente', 'USUARIO',
        'condicion', 'OBLIGATORIO',
        'descripcion', 'Modalidad orgánica de la delegación.'
      ),
      jsonb_build_object(
        'variable', 'DELEGACION.facultades_texto',
        'fuente', 'USUARIO',
        'condicion', 'OBLIGATORIO',
        'descripcion', 'Texto íntegro del alcance, límites y régimen de actuación.'
      ),
      jsonb_build_object(
        'variable', 'DELEGACION.quorum_reforzado',
        'fuente', 'USUARIO',
        'condicion', 'OBLIGATORIO',
        'descripcion', 'Constancia de constitución y mayoría reforzada aplicada.'
      ),
      jsonb_build_object(
        'variable', 'DELEGACION.agreement_id',
        'fuente', 'EXPEDIENTE',
        'condicion', 'OBLIGATORIO',
        'descripcion', 'Identificador trazable del acuerdo.'
      )
    ),
    capa3_editables = jsonb_build_array(
      jsonb_build_object(
        'campo', 'DELEGACION.modalidad',
        'tipo', 'select',
        'opciones', jsonb_build_array('CONSEJERO_DELEGADO', 'COMISION_EJECUTIVA'),
        'obligatoriedad', 'OBLIGATORIO',
        'descripcion', 'Seleccione la figura orgánica destinataria de la delegación.'
      ),
      jsonb_build_object(
        'campo', 'DELEGACION.facultades_texto',
        'tipo', 'textarea',
        'obligatoriedad', 'OBLIGATORIO',
        'descripcion', 'Texto íntegro de las facultades, sus límites y el régimen de actuación.'
      ),
      jsonb_build_object(
        'campo', 'DELEGACION.quorum_reforzado',
        'tipo', 'textarea',
        'obligatoriedad', 'OBLIGATORIO',
        'descripcion', 'Constancia del quórum y de la mayoría de dos tercios aplicada.'
      )
    ),
    notas_legal = concat_ws(
      E'\n',
      nullif(notas_legal, ''),
      '2026-07-19: alineadas las variables USUARIO con Capa 3 e incorporados el anexo de facultades y la constancia de mayoría al cuerpo generado.'
    ),
    content_hash_sha256 = encode(
      digest(
        convert_to(
          $hash_input$DELEGACION_FACULTADES|1.1.1|DELEGACION.modalidad|DELEGACION.facultades_texto|DELEGACION.quorum_reforzado$hash_input$,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  WHERE id = 'd3e08b42-a67e-4b33-9bbb-2689b5d8d4cf'
    AND tipo = 'MODELO_ACUERDO'
    AND materia_acuerdo = 'DELEGACION_FACULTADES'
    AND estado = 'ACTIVA';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Expected one active DELEGACION_FACULTADES template, updated %', v_updated;
  END IF;
END;
$$;

