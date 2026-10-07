# Tasks

## 1. Frontend - Importar deleteDocument en App.tsx

- [x] 1.1 Actualizar el import de useUserDocuments en App.tsx para incluir deleteDocument y verificar que el código compila sin errores
- [x] 1.2 Verificar que deleteDocument esté disponible en el objeto devuelto por useUserDocuments

## 2. Frontend - Añadir botón de eliminar a cada documento

- [x] 2.1 Añadir botón de eliminar (🗑️ o "Eliminar") a cada item en documents-list__item y verificar que se renderiza correctamente
- [x] 2.2 Implementar diálogo de confirmación al hacer clic en el botón y verificar que aparece antes de eliminar
- [x] 2.3 Conectar el botón al método deleteDocument con el id del documento y verificar que la llamada se ejecuta
- [x] 2.4 Deshabilitar el botón de eliminar mientras se procesa la eliminación y verificar el estado visual

## 3. Frontend - Mostrar fecha de expiración

- [x] 3.1 Añadir campo para mostrar expiresAt en cada item de documento en App.tsx y verificar que se muestra
- [x] 3.2 Formatear la fecha usando toLocaleDateString() o similar y verificar el formato legible
- [x] 3.3 Añadir etiqueta "Expira: " o similar para claridad y verificar el texto está visible

## 4. Frontend - Añadir mensaje de privacidad

- [x] 4.1 Añadir mensaje de privacidad en la vista de documentos y verificar que es visible
- [x] 4.2 Asegurar que el mensaje menciona "30 días" y verificar que el texto está presente
- [x] 4.3 Asegurar que el mensaje menciona "borrado manual" y verificar que el texto está presente
- [x] 4.4 Asegurar que el mensaje menciona "Gemini" y verificar que el texto está presente

## 5. Testing y validación

- [x] 5.1 Probar manualmente la eliminación de un documento y verificar que desaparece de la lista
- [x] 5.2 Probar manualmente la cancelación de eliminación y verificar que el documento permanece
- [x] 5.3 Probar manualmente que la fecha de expiración se muestra correctamente para todos los documentos
- [x] 5.4 Verificar que el mensaje de privacidad es visible y legible en la vista de documentos
- [x] 5.5 Probar en móvil/tablet que los botones son accesibles y el diálogo de confirmación funciona

## 6. Integración y revisión

- [x] 6.1 Verificar que no hay errores de consola en el navegador al interactuar con los documentos
- [x] 6.2 Verificar que la lista de documentos se actualiza correctamente después de eliminar
- [x] 6.3 Revisar que el código sigue el estilo existente del proyecto
