# Privacy Message Specification

## Purpose

Informar al usuario sobre la política de privacidad relacionada con el manejo de documentos: retención por 30 días, borrado manual y uso de Gemini para RAG.

## Requirements

### Requirement: Mensaje de privacidad visible
El frontend SHALL mostrar un mensaje de privacidad en la vista de "Mis Documentos".

#### Scenario: Mensaje visible en la página de documentos
- **WHEN** el usuario navega a la sección "Mis Documentos"
- **THEN** el sistema muestra un mensaje de privacidad sobre el manejo de documentos

### Requirement: Contenido del mensaje
El mensaje de privacidad SHALL mencionar los siguientes puntos:

#### Scenario: Mención de retención de 30 días
- **WHEN** el usuario lee el mensaje de privacidad
- **THEN** el mensaje menciona que "Los documentos se guardan por 30 días"

#### Scenario: Mención de borrado manual
- **WHEN** el usuario lee el mensaje de privacidad
- **THEN** el mensaje menciona que "Puedes borrar tus documentos manualmente"

#### Scenario: Mención de envío a Gemini
- **WHEN** el usuario lee el mensaje de privacidad
- **THEN** el mensaje menciona que "El texto se envía a Gemini para generar el itinerario"