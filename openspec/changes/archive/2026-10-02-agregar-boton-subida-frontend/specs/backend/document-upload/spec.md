# Spec Delta

## Purpose

Gestiona la subida de documentos de usuario al sistema de RAG privado, incluyendo validación de extensiones permitidas.

## ADDED Requirements

### Requirement: Aceptar archivos .txt
El endpoint /upload SHALL aceptar archivos con extensión .txt para subida de documentos de usuario.

#### Scenario: Subida de archivo .txt exitosa
- **WHEN** un usuario envía un archivo .txt válido al endpoint /upload
- **THEN** el sistema procesa el archivo y lo almacena en el RAG privado

#### Scenario: Validación de extensión .txt
- **WHEN** un usuario intenta subir un archivo con extensión .txt
- **THEN** el sistema valida que la extensión está en la lista de permitidas

### Requirement: Validación de extensiones de archivo
El sistema SHALL validar que los archivos subidos tengan extensiones .pdf, .md o .txt.

#### Scenario: Archivo con extensión .pdf aceptado
- **WHEN** un usuario sube un archivo .pdf
- **THEN** el sistema acepta el archivo

#### Scenario: Archivo con extensión .md aceptado
- **WHEN** un usuario sube un archivo .md
- **THEN** el sistema acepta el archivo

#### Scenario: Archivo con extensión .txt aceptado
- **WHEN** un usuario sube un archivo .txt
- **THEN** el sistema acepta el archivo

#### Scenario: Archivo con extensión no permitida rechazado
- **WHEN** un usuario sube un archivo .jpg
- **THEN** el sistema rechaza el archivo con error "Formato no permitido"
