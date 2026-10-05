# Spec Delta

## Purpose

Permite a los usuarios subir documentos personales (.txt, .pdf, .md) desde la interfaz de usuario al sistema de RAG privado del backend.

## ADDED Requirements

### Requirement: Botón de subida visible
El frontend SHALL mostrar un botón o componente de subida de archivos en la interfaz de documentos del usuario.

#### Scenario: Botón visible en página de documentos
- **WHEN** el usuario navega a la sección de "Mis Documentos"
- **THEN** el sistema muestra un botón con etiqueta "Subir Documento" o similar

### Requirement: Selección de archivo
El componente SHALL permitir al usuario seleccionar un archivo desde su sistema de archivos local.

#### Scenario: Selección exitosa
- **WHEN** el usuario hace clic en el botón de subida
- **THEN** el sistema abre un diálogo de selección de archivo

#### Scenario: Selección cancelada
- **WHEN** el usuario abre el diálogo y hace clic en "Cancelar"
- **THEN** el sistema no envía ninguna solicitud al backend

### Requirement: Validación de extensión client-side
El componente SHALL validar que el archivo seleccionado tiene una extensión permitida (.txt, .pdf, .md) antes de intentar subirlo.

#### Scenario: Archivo con extensión válida
- **WHEN** el usuario selecciona un archivo con extensión .txt
- **THEN** el sistema permite continuar con la subida

#### Scenario: Archivo con extensión inválida
- **WHEN** el usuario selecciona un archivo con extensión .jpg
- **THEN** el sistema muestra un mensaje de error "Solo se aceptan archivos .txt, .pdf o .md"

#### Scenario: Archivo sin extensión
- **WHEN** el usuario selecciona un archivo sin extensión
- **THEN** el sistema muestra un mensaje de error "Formato de archivo no válido"

### Requirement: Validación de tamaño client-side
El componente SHALL validar que el archivo no exceda los 10MB antes de enviar.

#### Scenario: Archivo dentro del límite
- **WHEN** el usuario selecciona un archivo de 5MB
- **THEN** el sistema permite continuar con la subida

#### Scenario: Archivo excede límite
- **WHEN** el usuario selecciona un archivo de 15MB
- **THEN** el sistema muestra un mensaje de error "El archivo supera el máximo permitido (10MB)"

### Requirement: Envío al endpoint /upload
El componente SHALL enviar el archivo al endpoint POST /upload del backend con los campos filename y fileBase64 en el body.

#### Scenario: Envío exitoso
- **WHEN** el usuario selecciona un archivo válido y confirma la subida
- **THEN** el sistema envía una solicitud POST a /upload con el archivo codificado en base64

### Requirement: Manejo de errores del backend
El componente SHALL mostrar mensajes de error apropiados según la respuesta del backend.

#### Scenario: Error de formato no permitido
- **WHEN** el backend responde con error "Formato no permitido"
- **THEN** el sistema muestra al usuario "Solo se aceptan archivos .txt, .pdf o .md"

#### Scenario: Archivo demasiado grande
- **WHEN** el backend responde con error "El archivo supera el máximo permitido"
- **THEN** el sistema muestra al usuario "El archivo es demasiado grande (máximo 10MB)"

#### Scenario: Archivo vacío
- **WHEN** el backend responde con error "El archivo está vacío"
- **THEN** el sistema muestra al usuario "El archivo seleccionado está vacío"

### Requirement: Confirmación de éxito
El componente SHALL mostrar una confirmación al usuario cuando la subida sea exitosa.

#### Scenario: Subida exitosa
- **WHEN** el backend responde con status 201 y los datos del documento
- **THEN** el sistema muestra un mensaje "Documento subido con éxito" y actualiza la lista de documentos

### Requirement: Estado de carga
El componente SHALL mostrar un indicador de carga mientras se procesa la subida.

#### Scenario: Mostrar indicador durante subida
- **WHEN** el usuario envía un archivo
- **THEN** el sistema muestra un spinner o barra de progreso hasta completar la operación
