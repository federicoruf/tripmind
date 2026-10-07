# Document Expiry Display Specification

## Purpose

Muestra la fecha de expiración de cada documento al usuario en la interfaz de gestión de documentos.

## Requirements

### Requirement: Campo expiresAt en la interfaz
El frontend SHALL mostrar la fecha de expiración (`expiresAt`) para cada documento en la lista.

#### Scenario: Fecha visible para cada documento
- **WHEN** el usuario navega a la sección "Mis Documentos"
- **THEN** el sistema muestra la fecha de expiración de cada documento

### Requirement: Formato de fecha legible
El frontend SHALL formatear la fecha de expiración en un formato legible para el usuario.

#### Scenario: Formato local
- **WHEN** el usuario visualiza la lista de documentos
- **THEN** el sistema muestra la fecha en formato local (ej. "07/10/2026" o "Oct 7, 2026")

### Requirement: Datos ya disponibles del backend
El frontend SHALL usar el campo `expiresAt` que ya devuelve el endpoint GET /api/documents.

#### Scenario: Uso de expiresAt
- **WHEN** el backend devuelve documentos con campo `expiresAt`
- **THEN** el sistema usa ese valor para mostrar la fecha de expiración