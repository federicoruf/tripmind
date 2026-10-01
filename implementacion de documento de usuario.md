# Plan de implementación — Documentos del usuario en TripMind (RAG privado)

## Decisiones tomadas

- Formatos: PDF y Markdown. Máx. 10 MB por archivo, máx. 5 documentos por usuario.
- Retención: **30 días fijos** desde la subida (el usuario puede borrar antes).
- El **archivo original no se guarda**: se procesa en memoria y se descarta.
- Cifrado: se cifra el **texto** de cada fragmento (AES-256-GCM). Los vectores quedan en claro (si se cifran, no se puede buscar).
- Limpieza: job diario con Cloud Scheduler que llama a un endpoint protegido.
- Colección nueva en Chroma, separada de las guías públicas.

> Nota: Chroma no tiene expiración automática. Solo permite borrar por id o por filtro de metadata, por eso la limpieza la hace el backend.

---

## Paso 1 — Base de datos (Postgres)

1. Crear la tabla `user_documents` con: `id`, `user_id`, `filename`, `status` (`processing` / `ready` / `error`), `chunk_count`, `created_at`, `expires_at`.
2. Crear un índice por `user_id` y otro por `expires_at`.
3. Agregar funciones de acceso en un archivo nuevo (ej. `documents.ts`): crear, listar por usuario, contar por usuario, actualizar estado, borrar, listar vencidos.

## Paso 2 — Cifrado del texto

1. Generar una clave maestra de 32 bytes y guardarla como variable de entorno (`DOCS_MASTER_KEY`): en Railway para dev y como secreto en Cloud Run para producción.
2. Crear un módulo `crypto.ts` con dos funciones: cifrar texto y descifrar texto.
3. La clave de cada usuario se **deriva** de la clave maestra + su `user_id` (no se guarda una clave por usuario).
4. Cada fragmento usa un valor aleatorio (nonce) distinto. El resultado guardado incluye nonce + texto cifrado + etiqueta de autenticación.
5. Agregar un test: cifrar y descifrar devuelve el texto original, y una clave de otro usuario falla.

## Paso 3 — Colección de Chroma para usuarios

1. En `chromaClient.ts` (o un archivo nuevo) definir la colección `tripmind_user_docs`, con distancia coseno (igual que `tripmind_guides`).
2. Metadata de cada fragmento: `user_id`, `document_id`, `expires_at` (número, fecha en formato timestamp).
3. Id de cada fragmento: `documentId-índice`.
4. En metadata **no** guardar el nombre del archivo (vive en Postgres).

## Paso 4 — Servicio de procesamiento

1. Adaptar `extract.ts` para poder leer desde un buffer en memoria (hoy solo lee desde una ruta de archivo).
2. Crear `services/userDocuments.ts` con el flujo:
   1. Validar límites (tipo, tamaño, cantidad de documentos del usuario).
   2. Crear el registro en Postgres con estado `processing`.
   3. Extraer texto → dividir en fragmentos (`chunkText`) → calcular vector (`embed`).
   4. Cifrar el texto de cada fragmento.
   5. Guardar en Chroma con la metadata del Paso 3.
   6. Marcar el registro como `ready`.
3. Si algo falla a mitad de camino: borrar lo que se haya guardado en Chroma y marcar `error`.
4. Poner un tope de fragmentos por documento para controlar el costo de embeddings.

## Paso 5 — Endpoints del backend

Crear `routes/documents.ts`, todos protegidos con `checkJwt`. El `userId` sale siempre del token.

1. `POST /documents/upload`: recibe el archivo (agregar una librería para multipart, como multer, con límite de 10 MB). Valida tipo y contenido, y llama al servicio del Paso 4.
2. `GET /documents`: lista los documentos del usuario con estado y fecha de expiración.
3. `DELETE /documents/:id`: verifica que el documento sea del usuario, borra sus fragmentos en Chroma (filtrando por `document_id` **y** `user_id`) y luego el registro en Postgres.
4. Registrar las rutas en `index.ts`.
5. Agregar límite de frecuencia de subida por usuario.

## Paso 6 — Búsqueda con documentos del usuario

1. En `retrieve.ts`, agregar una función que consulte `tripmind_user_docs` filtrando por `user_id` **y** `expires_at` mayor a la fecha actual.
2. Descifrar solo los fragmentos recuperados.
3. En `promptBuilder.ts` (donde hoy se llama a `retrieveContext`) recibir el `userId`, buscar en ambas colecciones y mezclar los resultados con el mismo umbral de distancia.
4. Marcar el origen de los fragmentos de usuario como "tu documento: nombre.pdf" (el nombre sale de Postgres) para que el campo `source` del itinerario lo muestre.
5. Actualizar el prompt del sistema y el schema del itinerario si hace falta un nuevo tipo de `source`.

## Paso 7 — Privacidad en logs y Langfuse

1. Revisar que `DEBUG_RAG` y `logger.ts` no impriman texto de fragmentos de usuario.
2. En los traces de Langfuse (`itinerary.ts`, `promptBuilder.ts`, `toolLoop.ts`), ocultar o recortar el contexto que viene de documentos del usuario. Dejar solo datos como cantidad de fragmentos y ids.
3. Verificar en el dashboard que no aparezca contenido privado.

## Paso 8 — Limpieza por expiración

1. Crear una función que: busca en Postgres los documentos con `expires_at` vencido, borra sus fragmentos en Chroma por `document_id`, y luego borra el registro.
2. Exponerla en un endpoint interno (ej. `POST /internal/cleanup`) protegido con un secreto propio (`CRON_SECRET`) en un header, no con el token de Auth0.
3. Crear un trabajo en **Cloud Scheduler** (una vez al día) que llame a ese endpoint.
4. Como plan B, la búsqueda del Paso 6 ya ignora fragmentos vencidos.
5. Registrar en logs solo cuántos documentos se borraron, sin contenido.

## Paso 9 — Frontend

1. Componente de subida (selector de archivo o arrastrar), visible solo con sesión activa. Puedes tomar como referencia `ImageUploader.tsx`.
2. Lista de documentos con estado (procesando / listo / error), fecha de expiración y botón de borrar.
3. Mostrar el estado de subida y los errores (archivo muy grande, formato no permitido, límite de 5 alcanzado).
4. Mensaje de privacidad visible que explique: qué se guarda, por cuánto tiempo, que se puede borrar en cualquier momento, y que el texto se envía a Gemini para generar el itinerario.
5. En el itinerario, mostrar el origen "tu documento" en las actividades que vengan de un archivo del usuario.

## Paso 10 — Pruebas

1. Cifrado: ida y vuelta, y fallo con otra clave.
2. Aislamiento: el usuario A nunca recibe fragmentos del usuario B (probar con dos usuarios).
3. Borrado: tras `DELETE`, no quedan fragmentos en Chroma ni registro en Postgres.
4. Expiración: un documento con fecha vencida no aparece en la búsqueda y el job lo elimina.
5. Límites: archivo de más de 10 MB, formato inválido, sexto documento.
6. Archivo corrupto o PDF sin texto.
7. Revisar Langfuse y logs para confirmar que no hay contenido privado.

## Paso 11 — Despliegue

1. Agregar `DOCS_MASTER_KEY` y `CRON_SECRET` en Railway (dev y prod) y en Cloud Run.
2. Crear la tabla en ambos ambientes de Postgres.
3. Crear el trabajo de Cloud Scheduler.
4. Probar el flujo completo en producción con una cuenta de prueba.
5. Actualizar el README: nueva funcionalidad, decisión de cifrado, retención de 30 días y límites.

---

## Orden recomendado

Paso 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

Puedes probar el flujo de backend (pasos 1 al 6) con el token de prueba de Auth0 antes de tocar el frontend.

## Limitaciones a tener presentes

- El cifrado es del texto guardado, no de extremo a extremo: el backend descifra para armar el prompt y el texto llega a Gemini.
- Perder `DOCS_MASTER_KEY` significa perder acceso a todos los textos guardados. Guarda una copia segura.
- Si más adelante se quiere cifrado más fuerte (claves propias del cliente), Chroma Cloud ofrece CMEK, pero es una función enterprise.

----------

# Ejecución del plan
# Documentos del usuario para RAG privado — Pasos 1 a 6 (en curso)

Que el usuario pueda subir sus propios archivos (PDF/MD) para que TripMind los use al generar el itinerario, además de las guías públicas ya existentes.

## Qué se implementó

- **Tabla `user_documents` en Postgres**: registro de cada documento subido (`id, user_id, filename, status, chunk_count, created_at, expires_at`). El archivo original **no se guarda**, solo este metadato.
- **Cifrado del texto**: cada fragmento (chunk) se cifra con AES-256-GCM antes de guardarse en Chroma. La clave de cada usuario se deriva (HKDF) de una clave maestra (`DOCS_MASTER_KEY`) + su `user_id`, así no hay que guardar una clave por usuario. El vector de cada fragmento se guarda sin cifrar (así Chroma lo puede seguir comparando para la búsqueda por similitud); lo único cifrado es el texto legible del fragmento.
- **Colección nueva en Chroma**: `tripmind_user_docs`, separada de `tripmind_guides`. Metadata por fragmento: `user_id`, `document_id`, `expires_at` (timestamp). El nombre del archivo no se guarda ahí, vive en Postgres.
- **Endpoints** (`/api/documents`, protegidos con `checkJwt`): subir (`POST /upload`, archivo en base64), listar (`GET /`) y borrar (`DELETE /:id`). El `userId` siempre sale del token, nunca del body.
- **Uso en el itinerario**: al generar un itinerario, ahora se busca en paralelo en las guías públicas y en los documentos del propio usuario (filtrando por `user_id` y por `expires_at` vigente), se descifran solo los fragmentos recuperados, y se mezclan en el mismo prompt. En el itinerario se ven marcados como `"Tu documento: nombre.pdf"`.
- **Límites del MVP**: PDF y Markdown, máx. 10MB por archivo, máx. 5 documentos por usuario, vencimiento a los 30 días desde la subida.

## Decisiones de diseño

- **El archivo original no se guarda.** Se procesa en memoria (extraer texto → chunkear → embeber → cifrar) y se descarta. Menos superficie de ataque, no hace falta storage tipo S3.
- **Se cifra el texto, no el vector.** Es la única forma de mantener la búsqueda semántica funcionando: si se cifra el vector, Chroma no puede compararlo con nada.
- **No es cifrado de extremo a extremo.** El backend descifra para armar el prompt, y ese texto viaja a Gemini para generar el itinerario. El límite real es que protege contra quien acceda solo a Chroma o a una copia de la base, no contra quien controle el backend.
- **Documentos del usuario primero en el prompt.** `buildAugmentedPrompt` trunca por caracteres si el contexto combinado no entra completo; poner los fragmentos del usuario antes que las guías genéricas evita que se corten primero. Estos documento tienen mas peso que las guías genéricas que hayamos publicado.
- **La colección de Chroma filtra por `user_id` y por vencimiento en la misma query** (no solo al insertar), como segundo seguro además del job de limpieza (todavía no implementado, Paso 8).

## Archivos backend nuevos

- `sql/001_user_documents.sql` — crea la tabla `user_documents` y sus índices.
- `src/documents.ts` — acceso a la tabla: crear, listar, contar, actualizar estado, borrar, listar vencidos, resolver nombres de archivo por id.
- `src/utils/textCrypto.ts` — `encryptText`/`decryptText` (AES-256-GCM, clave derivada por usuario).
- `src/utils/textCrypto.test.ts` — 9 tests (ida y vuelta, aislamiento entre
  usuarios, detección de datos alterados, validación de la clave maestra).
- `src/rag/userDocsChroma.ts` — colección `tripmind_user_docs`: guardar y
  borrar fragmentos cifrados.
- `src/rag/retrieveUserDocs.ts` — búsqueda semántica en los documentos del
  usuario, con descifrado puntual de lo recuperado.
- `src/services/userDocuments.ts` — orquesta la subida completa: valida,
  registra, extrae texto, chunkea, embebe, cifra, guarda; revierte en Chroma
  y marca error si algo falla a mitad de camino.
- `src/routes/documents.ts` — endpoints `POST /upload`, `GET /`,
  `DELETE /:id`.

## Archivos backend modificados

- `src/constans.ts` — nuevas constantes: `MAX_DOC_BYTES`,
  `ALLOWED_DOC_EXTENSIONS`, `MAX_CHUNKS_PER_DOCUMENT`.
- `src/rag/extract.ts` — se agregó `extractTextFromBuffer` (lee desde
  memoria) al lado de `extractText` (que sigue igual, lee desde disco).
- `src/services/promptBuilder.ts` — `buildFinalPrompt` ahora recibe
  `userId` y mezcla `retrieveContext` (guías) con `retrieveUserContext`
  (documentos del usuario).
- `src/services/itinerary.ts` — `generateItinerary` y `streamItinerary`
  pasan `userId` a `buildFinalPrompt`.
- `src/index.ts` — se registró la ruta `/api/documents` con límite de body
  de 14MB (un archivo de 10MB pesa ~13.3MB en base64, igual razonamiento que
  ya existía para `/api/image`); se agregó `"DELETE"` a los métodos
  permitidos por CORS (faltaba, lo iba a necesitar el endpoint de borrado).

## Validado

- `npx tsc --noEmit` sobre **todo** el proyecto (no solo los archivos
  nuevos): 0 errores.
- Suite completa de tests: 53/54 pasan. El único que falla
  (`Computefinaloutcome.test.ts`) es un problema preexistente de
  mayúsculas/minúsculas en el nombre del archivo, no relacionado con estos
  cambios.
- Revisión manual de la integración de punta a punta (nombres de campos,
  tipos, firmas de función) entre los 6 pasos.
- Se encontraron y corrigieron 2 bugs de integración durante la revisión:
  CORS sin `DELETE` habilitado, y un error de tipos con `req.params.id` en
  Express 5.

## Pendiente / próximo paso

Según el plan, sigue el **Paso 7: privacidad en logs y Langfuse**. Ya
detectado como pendiente crítico: el `augmentedPrompt` con los fragmentos
del usuario **ya descifrados** se guarda hoy como input de la llamada a
Gemini en los traces de Langfuse (`gen.update({ input: augmentedPrompt })`
en `itinerary.ts`), lo que expone contenido privado del usuario en el
dashboard de observabilidad. Falta ocultar o recortar ese contenido en los
traces antes de considerar esta función lista para producción.

Después de eso: Paso 8 (job de limpieza por vencimiento — `documents.ts` ya
tiene `listExpiredDocuments`/`deleteDocumentById` listos, falta el
endpoint interno y el Cloud Scheduler), Paso 9 (frontend de subida/lista),
Paso 10 (pruebas de integración) y Paso 11 (variables de entorno y
despliegue).