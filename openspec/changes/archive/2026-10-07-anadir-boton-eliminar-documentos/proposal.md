# Proposal

## Why

Actualmente los usuarios pueden subir documentos para su RAG privado, pero no pueden eliminarlos desde la interfaz. El método `deleteDocument` ya existe en el hook `useUserDocuments` y el backend ya soporta el endpoint DELETE `/api/documents/:id`. Además, falta mostrar la fecha de expiración (`expiresAt`) que ya devuelve el backend, y no hay un mensaje claro sobre la política de privacidad (30 días de retención, borrado manual, y que el texto se envía a Gemini).

## What Changes

- **Frontend - App.tsx**: Añadir botón de eliminar a cada documento en la lista, conectado al método `deleteDocument` de `useUserDocuments`
- **Frontend - App.tsx**: Mostrar la fecha de expiración (`expiresAt`) de cada documento en la lista
- **Frontend - App.tsx**: Añadir mensaje de privacidad en la vista de documentos que explique: los documentos se guardan por 30 días, pueden ser borrados manualmente, y el texto se envía a Gemini para el RAG
- **Frontend - useUserDocuments.ts**: Ya existe `deleteDocument` y `UserDocument.expiresAt` - no se modifican
- **Backend**: NO se requieren cambios - GET /api/documents ya devuelve `expiresAt`, y DELETE /api/documents/:id ya está implementado

## Capabilities

### New Capabilities
- `frontend/document-delete`: Capacidad del frontend para eliminar documentos de usuario desde la interfaz
- `frontend/document-expiry-display`: Capacidad del frontend para mostrar la fecha de expiración de los documentos
- `frontend/privacy-message`: Capacidad del frontend para mostrar el mensaje de privacidad sobre el manejo de documentos

### Modified Capabilities
- Ninguna (el backend ya cumple con los requisitos de `expiresAt` y borrado)

## Impact

- **Frontend**: Modificaciones en `App.tsx` para añadir botones de eliminación, mostrar fecha de expiración y mensaje de privacidad
- **Backend**: Sin cambios - funcionalidad ya existente
- **Usuarios**: Podrán gestionar sus documentos (ver fecha de expiración, eliminarlos manualmente) y entenderán la política de privacidad
