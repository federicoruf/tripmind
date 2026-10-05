# Design

## Context

El backend ya tiene un endpoint `/upload` en `src/routes/documents.ts` que acepta archivos en base64 con los campos `filename` y `fileBase64`. Actualmente valida extensiones `.pdf` y `.md` en `src/constans.ts` (ALLOWED_DOC_EXTENSIONS). El frontend no tiene interfaz para esta funcionalidad. See proposal.md for full motivation.

## Goals / Non-Goals

**Goals:**
- Proporcionar una interfaz intuitiva para subir documentos desde el frontend
- Mantener la validación consistente entre client-side y server-side
- Integrar con el endpoint existente sin modificar su contracto
- Extender el soporte a archivos .txt

**Non-Goals:**
- Cambiar el mechanism de autenticación (JWT ya está implementado)
- Modificar el almacenamiento de documentos (Chroma + Postgres)
- Añadir soporte para otros formatos fuera de .txt, .pdf, .md
- Implementar drag-and-drop (solo subida por botón)

## Decisions

### Decisión 1: Validación client-side antes del envío
**Rationale**: Reduce carga innecesaria en el servidor y mejora UX al dar feedback inmediato al usuario. La validación server-side sigue siendo necesaria como capa de seguridad.

**Alternatives considered**:
- Solo validación server-side: menor código frontend pero peor UX
- Validación solo server-side: menos seguro (el usuario podría eludirla)

### Decisión 2: Conversión a base64 en el frontend
**Rationale**: El endpoint espera `fileBase64`, por lo que el frontend debe convertir el File object a base64 antes del envío. Esto es consistente con el patrón usado en `routes/image.ts`.

**Alternatives considered**:
- Enviar como multipart/form-data: requeriría modificar el endpoint
- Enviar el archivo crudo: no compatible con el endpoint existente

### Decisión 3: Extensión .txt añadida a ALLOWED_DOC_EXTENSIONS
**Rationale**: El usuario requiere soporte para .txt. La modificación es minimal (solo añadir ".txt" al array) y no afecta la lógica existente.

**Alternatives considered**:
- Crear un nuevo array de extensiones: redundante
- Usar validación separada para .txt: menos maintainable

### Decisión 4: Ubicación del botón
**Rationale**: El botón debe estar en la página "Mis Documentos" del frontend, probablemente en la esquina superior derecha o como un FAB (Floating Action Button) para máxima visibilidad.

**Alternatives considered**:
- En la barra lateral: menos visible
- En un menú desplegable: menos accesible

### Decisión 5: Feedback visual durante la subida
**Rationale**: Mostrar un spinner y deshabilitar el botón durante el envío para evitar subidas duplicadas y comunicar que la operación está en progreso.

## Risks / Trade-offs

**[Riesgo] Tamaño de archivo grande en memoria**: Convertir archivos grandes a base64 puede consumir memoria en el frontend.
→ **Mitigación**: Validar tamaño antes de la conversión. Usar FileReader con chunks si necesario (pero el límite es 10MB, manejable).

**[Riesgo] Inconsistencia entre validaciones**: Si la validación client-side y server-side divergen, el usuario podría recibir errores confusos.
→ **Mitigación**: Mantener ALLOWED_DOC_EXTENSIONS y MAX_DOC_BYTES como fuente única de verdad. Usar los mismos valores en el frontend.

**[Riesgo] Experiencia de usuario fragmentada**: Si el usuario sube un archivo y hay un error, necesita feedback claro.
→ **Mitigación**: Mostrar mensajes de error específicos del backend al usuario. Usar los mensajes definidos en ERROR_MESSAGES de documents.ts.

## Migration Plan

**Backend**:
1. Modificar `src/constans.ts`: añadir ".txt" a ALLOWED_DOC_EXTENSIONS
2. No se requiere migración de datos ni downtime

**Frontend**:
1. Crear componente DocumentUploadButton
2. Integrar en la página de Mis Documentos
3. Testing de UX

**Rollback**: Dado que los cambios son aditivos (solo se añade .txt), el rollback sería reverting el cambio en constans.ts. El botón del frontend puede ser feature-flaggeado si necesario.

## Open Questions

- ¿Dónde exactamente debe ir el botón en la UI? (Se asumirá esquina superior derecha de la página de documentos)
- ¿Debe haber un límite de archivos por usuario en el frontend? (El backend ya lo maneja)
- ¿Se necesita progreso de subida (progress bar) o basta con un spinner? (Se asumirá spinner por simplicidad)
