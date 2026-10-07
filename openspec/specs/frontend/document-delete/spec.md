# Document Delete Specification

## Purpose

Permite a los usuarios eliminar documentos de su RAG privado desde la interfaz de usuario.

## Requirements

### Requirement: Botón de eliminar visible
El frontend SHALL mostrar un botón de eliminar para cada documento en la lista de documentos del usuario.

#### Scenario: Botón visible para cada documento
- **WHEN** el usuario navega a la sección "Mis Documentos"
- **THEN** el sistema muestra un botón de eliminar (ej. "🗑️" o "Eliminar") para cada documento

### Requirement: Confirmación antes de eliminar
El frontend SHALL pedir confirmación al usuario antes de eliminar un documento.

#### Scenario: Confirmación mostrada
- **WHEN** el usuario hace clic en el botón de eliminar
- **THEN** el sistema muestra un diálogo de confirmación con mensaje "¿Estás seguro de que quieres eliminar este documento?"

#### Scenario: Eliminación cancelada
- **WHEN** el usuario cancela la confirmación
- **THEN** el sistema no envía la solicitud de eliminación y el documento permanece en la lista

### Requirement: Llamada al método deleteDocument
El frontend SHALL invocar el método `deleteDocument` del hook `useUserDocuments` al confirmar la eliminación.

#### Scenario: Llamada exitosa
- **WHEN** el usuario confirma la eliminación de un documento
- **THEN** el sistema llamará a `deleteDocument` con el `id` del documento seleccionado

### Requirement: Feedback visual durante la eliminación
El frontend SHALL mostrar un indicador de carga mientras se procesa la eliminación.

#### Scenario: Indicador de carga
- **WHEN** el usuario confirma la eliminación
- **THEN** el sistema muestra un spinner o deshabilita el botón hasta completar la operación

### Requirement: Actualización de la lista después de eliminar
El frontend SHALL actualizar la lista de documentos después de una eliminación exitosa.

#### Scenario: Lista actualizada
- **WHEN** el método `deleteDocument` devuelve éxito
- **THEN** el sistema actualiza la lista y el documento eliminado desaparece

### Requirement: Manejo de errores
El frontend SHALL mostrar un mensaje de error si la eliminación falla.

#### Scenario: Error de eliminación
- **WHEN** el método `deleteDocument` devuelve error
- **THEN** el sistema muestra un mensaje de error "No se pudo eliminar el documento" o el error específico devuelto por el backend