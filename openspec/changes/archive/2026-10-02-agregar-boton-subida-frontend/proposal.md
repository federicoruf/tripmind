# Proposal

## Why

Actualmente el backend ya tiene un endpoint `/upload` en `documents.ts` que permite a los usuarios subir documentos para su RAG privado, pero el frontend no tiene una interfaz para que los usuarios final suban sus archivos. Los usuarios no pueden subir documentos .txt, .pdf o .md desde la interfaz, limitando la utilidad del sistema de documentos personales.

Adicionalmente, el endpoint actual solo acepta .pdf y .md, pero el usuario quiere soportar también .txt. Esto requiere una modificación en el backend para ampliar las extensiones permitidas.

## What Changes

- **Frontend**: Añadir un botón/componente de subida de archivos en la interfaz de usuario que permita seleccionar y enviar archivos .txt, .pdf o .md al endpoint `/upload`
- **Backend**: Modificar `ALLOWED_DOC_EXTENSIONS` en `src/constans.ts` para incluir `.txt` junto a `.pdf` y `.md`
- **Validación**: El botón debe validar client-side que el archivo seleccionado tiene una extensión permitida antes de enviar
- **Integración**: El componente debe enviar el archivo como base64 en el body con los campos `filename` y `fileBase64` que espera el endpoint
- **Mensajes de error**: Mostrar mensajes de error apropiados al usuario según la respuesta del backend

## Capabilities

### New Capabilities
- `frontend/document-upload`: Capacidad del frontend para subir documentos de usuario al sistema de RAG privado

### Modified Capabilities
- `backend/document-upload`: Cambio en las extensiones de archivo aceptadas (añadir .txt a ALLOWED_DOC_EXTENSIONS)

## Impact

- **Frontend**: Componentes UI nuevos o modificados para la subida de archivos
- **Backend**: `src/constans.ts` - modificación de ALLOWED_DOC_EXTENSIONS
- **Endpoint**: `/upload` en `documents.ts` - sin cambios en la lógica, solo en la validación de extensiones
- **Usuarios**: Podrán subir documentos .txt, .pdf y .md desde la interfaz
