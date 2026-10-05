# Tasks

## 1. Backend - Extensión de archivos permitidos

- [x] 1.1 Modificar ALLOWED_DOC_EXTENSIONS en src/constans.ts para incluir ".txt" y verificar que el array contiene [".pdf", ".md", ".txt"]
- [x] 1.2 Ejecutar tests del backend para validar que la modificación no rompe funcionalidad existente

## 2. Frontend - Componente de subida

- [x] 2.1 Crear componente DocumentUploadButton en el frontend y verificar que se renderiza correctamente
- [x] 2.2 Implementar función para convertir File a base64 y verificar que la conversión funciona con archivos de prueba
- [x] 2.3 Implementar validación client-side de extensión (.txt, .pdf, .md) y verificar que rechaza archivos inválidos
- [x] 2.4 Implementar validación client-side de tamaño (máximo 10MB) y verificar que rechaza archivos demasiado grandes
- [x] 2.5 Implementar llamada POST al endpoint /upload con filename y fileBase64 y verificar que envía la solicitud correctamente
- [x] 2.6 Implementar manejo de errores del backend y verificar que muestra mensajes apropiados al usuario

## 3. Frontend - Integración UI

- [x] 3.1 Integrar DocumentUploadButton en la página de "Mis Documentos" y verificar que el botón es visible
- [x] 3.2 Añadir estado de carga (spinner) durante la subida y verificar que se muestra correctamente
- [x] 3.3 Añadir confirmación de éxito al usuario y verificar que el mensaje aparece después de subida exitosa
- [x] 3.4 Actualizar la lista de documentos después de subida exitosa y verificar que el nuevo documento aparece

## 4. Testing y validación

- [x] 4.1 Crear tests unitarios para la validación client-side y verificar que pasan
- [x] 4.2 Crear tests de integración para el flujo completo de subida y verificar que pasan
- [x] 4.3 Probar manualmente la subida de archivos .txt, .pdf y .md y verificar que todos funcionan
- [X] 4.4 Probar manualmente errores (archivo grande, extensión inválida) y verificar mensajes de error
- [X] 4.5 Validar que el backend rechaza correctamente archivos con extensiones no permitidas
