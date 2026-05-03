# Motor Plantillas baseline — 2026-05-03

Templates operational measured: 37
Iterations per template: 3
Overall p50 of template p50: 4.0 ms
Overall p95 of template p50: 141.0 ms

| Template | Version | Runs | p50 ms | p95 ms | Status |
|---|---:|---:|---:|---:|---|
| ACTA_ACUERDO_ESCRITO (1b1118a6) | 1.2.0 | 3 | 92.7 | 162.6 | OK |
| ACTA_CONSIGNACION (6f43fcce) | 1.1.0 | 3 | 78.4 | 87.2 | OK |
| ACTA_CONSIGNACION (56bcbb33) | 1.1.0 | 3 | 75.9 | 82.2 | OK |
| ACTA_DECISION_CONJUNTA (1e3b82a7) | 1.0.0 | 3 | 74.3 | 77.5 | OK |
| ACTA_ORGANO_ADMIN (b2409fb5) | 1.0.0 | 3 | 81.5 | 107.0 | OK |
| ACTA_SESION (53b34d3e) | 1.1.0 | 3 | 146.3 | 160.6 | OK |
| ACTA_SESION (36c28a8c) | 1.1.0 | 3 | 141.0 | 156.4 | OK |
| CERTIFICACION (ca3df363) | 1.2.0 | 3 | 74.0 | 85.2 | OK |
| COMISION_DELEGADA (a242e29e) | 1.0.0 | 3 | 5.4 | 7.5 | OK |
| CONVOCATORIA (76c3260e) | 1.1.0 | 3 | 71.3 | 75.8 | OK |
| CONVOCATORIA_SL_NOTIFICACION (1e1a7755) | 1.1.0 | 3 | 76.8 | 80.3 | OK |
| INFORME_DOCUMENTAL_PRE (438fa893) | 1.0.1 | 3 | 5.0 | 5.5 | OK |
| INFORME_GESTION (944ff8d4) | 1.0.0 | 3 | 3.2 | 4.4 | OK |
| INFORME_PRECEPTIVO (4c2644ec) | 1.0.1 | 3 | 73.6 | 76.2 | OK |
| MODELO_ACUERDO (e3697ad9) | 1 | 3 | 4.9 | 6.6 | OK |
| MODELO_ACUERDO (ee72efde) | 1 | 3 | 3.3 | 4.7 | OK |
| MODELO_ACUERDO (b846bb03) | 1 | 3 | 4.9 | 5.1 | OK |
| MODELO_ACUERDO (a09cc4bf) | 1 | 3 | 3.5 | 4.2 | OK |
| MODELO_ACUERDO (313e7609) | 1 | 3 | 4.0 | 4.4 | OK |
| MODELO_ACUERDO (df75cda9) | 1 | 3 | 3.5 | 5.1 | OK |
| MODELO_ACUERDO (edd5c389) | 0.1.0 | 3 | 3.5 | 4.7 | OK |
| MODELO_ACUERDO (395ca996) | 0.1.0 | 3 | 4.2 | 7.3 | OK |
| MODELO_ACUERDO (10f90d59) | 1.0.0 | 3 | 3.4 | 4.6 | OK |
| MODELO_ACUERDO (27be9063) | 1.0.0 | 3 | 3.4 | 4.3 | OK |
| MODELO_ACUERDO (433da411) | 1.0.0 | 3 | 3.9 | 4.1 | OK |
| MODELO_ACUERDO (ba214d42) | 1.0.0 | 3 | 7.2 | 8.1 | OK |
| MODELO_ACUERDO (c06957aa) | 0.1.0 | 3 | 4.2 | 4.7 | OK |
| MODELO_ACUERDO (2d814072) | 0.1.0 | 3 | 3.8 | 6.5 | OK |
| MODELO_ACUERDO (29739424) | 0.1.0 | 3 | 3.1 | 4.3 | OK |
| MODELO_ACUERDO (affa4219) | 1.0.0 | 3 | 4.0 | 4.3 | OK |
| MODELO_ACUERDO (389b0205) | 1.0.0 | 3 | 3.2 | 4.5 | OK |
| MODELO_ACUERDO (0b1beb86) | 1.0.0 | 3 | 3.2 | 4.1 | OK |
| MODELO_ACUERDO (f5b08793) | 1.0.0 | 3 | 3.0 | 6.6 | OK |
| MODELO_ACUERDO (73669c41) | 1.0.0 | 3 | 3.3 | 3.9 | OK |
| MODELO_ACUERDO (0f724a0d) | 1.0.0 | 3 | 2.7 | 3.6 | OK |
| MODELO_ACUERDO (68da89bc) | 0.1.0 | 3 | 2.8 | 3.5 | OK |
| MODELO_ACUERDO (e64ce755) | 0.1.0 | 3 | 3.1 | 4.5 | OK |

Notes:
- Read-only benchmark.
- Operational means ACTIVA/APROBADA or BORRADOR with aprobada_por and fecha_aprobacion.
- Archive disabled; evidence_status remains DEMO_OPERATIVA.
- Capa 2 uses synthetic deterministic variables to isolate composer/render/DOCX cost.
