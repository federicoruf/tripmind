# Design

## Context

El backend ya tiene implementado el endpoint DELETE `/api/documents/:id` y GET `/api/documents` devuelve el campo `expiresAt`. El hook `useUserDocuments` en el frontend ya expone el método `deleteDocument` y la interfaz `UserDocument` con el campo `expiresAt`. Actualmente, App.tsx usa el hook pero no implementa la funcionalidad de eliminación ni muestra la fecha de expiración. See proposal.md for full motivation.

## Goals / Non-Goals

**Goals:**
- Proporcionar una interfaz intuitiva para eliminar documentos desde el frontend
- Mostrar la fecha de expiración de cada documento de forma clara
- Informar al usuario sobre la política de privacidad de manera transparente
- Mantener la consistencia visual con el diseño existente

**Non-Goals:**
- Modificar el backend (ya está completo)
- Añadir autenticación adicional (JWT ya está implementado)
- Implementar drag-and-drop para eliminación
- Añadir notificaciones push para expiración

## Decisions

### Decisión 1: Botón de eliminar en cada item de la lista
**Rationale**: Proporciona una UX directa donde el usuario puede eliminar cualquier documento con un solo clic. Este patrón es común en interfaces de gestión de archivos.

**Alternatives considered**:
- Botón de eliminar masivo: más complejo y menos común para este caso de uso
- Menú contextual (right-click): menos discoverable en móvil
- Botón en un modal: añade pasos adicionales innecesarios

### Decisión 2: Confirmación antes de eliminar
**Rationale**: Previene eliminaciones accidentales. Los usuarios pueden hacer clic por error, y los documentos son valiosos para el RAG.

**Alternatives considered**:
- Eliminación sin confirmación: riesgo de pérdida de datos
- Confirmación solo para archivos importantes: añade complejidad sin beneficio claro

### Decisión 3: Uso del método deleteDocument existente
**Rationale**: El hook `useUserDocuments` ya tiene la lógica de eliminación implementada (llamada al endpoint, manejo de errores, actualización de la lista). Reutilizarlo evita duplicación de código.

**Alternatives considered**:
- Implementar la lógica directamente en App.tsx: duplicaría código
- Crear un nuevo hook: innecesario cuando el hook existente ya cumple

### Decisión 4: Mostrar expiresAt en formato local
**Rationale**: Las fechas en formato ISO son difíciles de leer para los usuarios. Usar `toLocaleDateString()` o similar mejora la UX.

**Alternatives considered**:
- Mostrar fecha relativa (ej. "en 23 días"): menos precisa
- Dejar en formato ISO: mala UX

### Decisión 5: Mensaje de privacidad en la vista de documentos
**Rationale**: Los usuarios que ven sus documentos son los que más necesitan entender la política de privacidad. El mensaje debe ser visible pero no intrusivo.

**Alternatives considered**:
- Modal al subir: el usuario ya lo vio al subir
- En settings: menos visible para el contexto relevante
- Footer global: demasiado genérico

## Risks / Trade-offs

**[Riesgo] Eliminación accidental sin confirmación**: Si el diálogo de confirmación falla o el usuario lo ignora, podría eliminar documentos importantes.
→ **Mitigación**: Usar un diálogo de confirmación claro con mensaje explícito. El método `deleteDocument` ya refresca la lista, así que no hay estado inconsistente.

**[Riesgo] Inconsistencia visual**: El botón de eliminar podría no encajar con el diseño existente.
→ **Mitigación**: Usar el mismo estilo de botones existente en el proyecto (clases CSS consistentes).

**[Riesgo] Mensaje de privacidad demasiado largo**: Podría saturar la interfaz.
→ **Mitigación**: Usar un mensaje conciso (1-2 líneas) en un lugar visible pero no prominente.

## Migration Plan

**Frontend:**
1. Modificar App.tsx para importar `deleteDocument` del hook `useUserDocuments`
2. Añadir botón de eliminar a cada item en la lista de documentos
3. Añadir diálogo de confirmación antes de llamar a `deleteDocument`
4. Mostrar fecha de expiración formateada para cada documento
5. Añadir mensaje de privacidad en la vista de documentos
6. Testing de UX

**Backend:**
- No se requiere migración - funcionalidad ya existente

**Rollback**: Dado que los cambios son solo en el frontend y son aditivos (solo se añaden elementos UI), el rollback sería revertir los cambios en App.tsx.

## Open Questions

- ¿Dónde exactamente debe ir el mensaje de privacidad en la UI? (Se asumirá debajo del título "Tus documentos")
- ¿Qué icono usar para el botón de eliminar? (Se asumirá 🗑️ o "Eliminar")
- ¿Debe el botón de eliminar estar deshabilitado mientras se elimina? (Se asumirá sí, para evitar acciones duplicadas)
