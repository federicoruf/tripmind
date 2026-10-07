# OpenSpec — Spec-driven development con agentes de IA (primer ciclo completado)

## Qué es OpenSpec

- Framework open source ligero (Fission-AI) para **spec-driven development**: se acuerda *qué* construir en archivos versionados antes de generar código con un asistente de IA.
- **No incluye ningún modelo ni agente propio.** Es un CLI + convenciones + prompts. Debe integrarse con un **agente de código con IA** (Claude Code, Cursor, GitHub Copilot, Mistral Vibe, etc.), que lee el código, genera las specs y escribe la implementación con el modelo que tenga configurado.
- Funciona bien en proyectos existentes (*brownfield*): no toca el código, solo agrega la carpeta `openspec/` y la configuración del agente.
- Compite/convive con herramientas similares como GitHub Spec Kit. Rinde en cambios medianos o grandes; para un fix de una línea es burocracia.
- Sin costo propio: el consumo es el del agente/modelo que se use.

## Estructura y flujo

- `openspec/specs/` → **fuente de verdad**: comportamiento actual de la app. Empieza vacía y se llena sola al archivar cambios.
- `openspec/changes/<nombre>/` → cambio activo: `proposal.md` (qué y por qué), `tasks.md` (pasos) y *spec deltas* (requisitos agregados/modificados).
- `openspec/changes/archive/` → cambios terminados. Al archivar, OpenSpec les añade un **prefijo de fecha** (`AAAA-MM-DD-nombre`) y los deltas se fusionan en `openspec/specs/`.
- Flujo: **propose → revisar → apply → archive**.
- Comandos útiles: `openspec list` (cambios activos), `openspec validate <nombre>` (formato, sin IA), `openspec update` (regenera las instrucciones del agente).
- No hace falta documentar toda la app antes de empezar: las specs se construyen cambio a cambio. Solo conviene escribir la spec de un área justo antes de **modificar** algo que ya existe.

## Integración con un agente de IA

1. Tener un agente de código instalado y acceso a un modelo (cuenta, suscripción o API key). Hay opciones con plan gratuito limitado y de pago; planes y límites cambian a menudo.
2. Ejecutar `openspec init` y **marcar solo los agentes que se usan**. Genera la configuración específica de cada uno (slash commands, skills o `AGENTS.md`). Se puede volver a ejecutar para añadir otros.
3. Los archivos generados son **prompts largos y estructurados** (frontmatter + instrucciones por etapa: explorar, proponer, aplicar, archivar). Conviene leerlos una vez; no editarlos, porque `openspec update` los pisa.
4. Las instrucciones **no se aplican solas**: hay que invocar el flujo de forma explícita (slash command, skill o petición en lenguaje natural). Si no, el agente programa directamente y se salta OpenSpec.
5. **Workaround general** si el agente no reconoce los comandos: pedirle que lea el archivo de instrucciones y lo siga:
   > Lee `<ruta al archivo de instrucciones>` y sigue sus instrucciones para crear una propuesta de cambio: [descripción]. Cuando termines, para y espera mi revisión.
EJEMPLO: Mistral Vibe (en Windows) - Luego una actualización, reconoció los comando de openspec
   `Usa el skill de OpenSpec para crear una propuesta de cambio: botón en el frontend (React) para subir un fichero .txt, .pdf o .md, que valide la subida usando el endpoint existente del backend. No implementes nada todavía.`
6. La calidad de specs y código depende del modelo del agente y de cuánto se revise. No encadenar propose + apply + archive en un solo mensaje: se pierde la revisión de la propuesta, que es lo que da valor al flujo.

## Ejemplo usado: Mistral Vibe (en Windows)

- Elegido por ser gratuito (cuota mensual limitada y límites de tasa en el plan Free).
- La información sobre el consumo mensual del modelo se encuentra en el [portal de Mistral](https://admin.mistral.ai/subscription).
- Tengo 8,5 euros para gastar mensualmente
- Su script de instalación `curl` no soporta Windows; funcionó `uv tool install mistral-vibe` (con `uv` instalado y su carpeta `%USERPROFILE%\.local\bin` en el PATH, reiniciando el editor por completo).
- No se instala ningún modelo local: se usa por cuenta o API key de Mistral.
- OpenSpec generó **skills** en `.vibe/skills/openspec-*/SKILL.md` (sin `AGENTS.md`). Vibe cargó los skills solo con la carpeta marcada como de confianza y reiniciando; no aparecieron como slash commands, así que se usó el workaround de pedirlos en lenguaje natural indicando la ruta.
- Si se cambia a Claude Code u otro agente, el flujo de OpenSpec es el mismo; cambia solo la carpeta de configuración generada y la forma de invocar las etapas.
- Al haber una validación realizada manualmente de las que no puede llevar a cabo la IA por si sola, encontre un error y lo que hice fue hacer referencia a la taraea y explicar lo que pasaba
## Comandos usados durante el proceso

### OpenSpec (CLI)

```bash
openspec init                       # crea openspec/ y la config del agente (marcar solo los agentes que se usan)
openspec list                       # cambios activos (solo funciona dentro de un root de OpenSpec)
openspec validate <nombre>          # valida el formato de un cambio activo
openspec archive <nombre>           # archiva un cambio (alternativa al skill del agente)
openspec update                     # regenera los archivos de instrucciones del agente
```

### Instalación del agente (ejemplo Mistral Vibe, Windows)

```powershell
# 1. El script oficial falló en Windows (solo soporta Linux/macOS)
curl -LsSf https://mistral.ai/vibe/install.sh | bash

# 2. Instalar uv (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 3. Comprobar uv por ruta completa y arreglar el PATH
& "$env:USERPROFILE\.local\bin\uv.exe" --version
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"        # solo para la sesión actual
[Environment]::SetEnvironmentVariable("Path", "$env:USERPROFILE\.local\bin;" + [Environment]::GetEnvironmentVariable("Path","User"), "User")   # permanente

# 4. Instalar y comprobar Vibe
uv tool install mistral-vibe
uv tool update-shell                # si avisa de que el PATH de herramientas no está configurado
vibe --version
vibe                                # arrancar el agente desde la raíz del proyecto
```

### Inspección y reorganización de archivos

```bash
ls .vibe/skills                     # nombres reales de los skills (en PowerShell: ls .vibe\skills)
ls -a backend                       # ver qué generó init (openspec/, .vibe/)
mv backend/openspec ./openspec      # mover el root de OpenSpec a la raíz del repo
mv backend/.vibe ./.vibe            # mover la config del agente
ls openspec/specs                   # specs resultantes
ls openspec/changes/archive         # cambios archivados
ls -a .vibe                         # comprobar qué contiene antes de commitear
git status                          # revisión final antes del commit
```

### Prompts al agente (lenguaje natural)

Propuesta:
> Lee `.vibe/skills/openspec-propose/SKILL.md` y sigue sus instrucciones para crear una propuesta de cambio: [descripción y endpoint]. No implementes nada todavía.

Implementación:
> Lee `.vibe/skills/openspec-apply-change/SKILL.md` e implementa las tareas del cambio `<nombre>`. Ve marcando cada tarea como hecha en tasks.md.

Archivado:
> Lee `.vibe/skills/openspec-archive-change/SKILL.md` y archiva el cambio `<nombre>`.

Corrección de errores dentro del cambio abierto:
> `userDocuments.ts:79` falla con "is not a function". Revisa qué exporta realmente el módulo `extract` y corrige el import. Añade una tarea a tasks.md si hace falta.

Nota: los nombres de los skills son los habituales de OpenSpec; confirmarlos siempre con `ls .vibe/skills`. Con otro agente (por ejemplo Claude Code) cambian la carpeta y la forma de invocar las etapas, pero los comandos `openspec ...` son los mismos.

## Primera prueba y ciclo completado

Cambio: **botón en el frontend (React) para subir ficheros .txt, .pdf o .md**, validando contra el endpoint del backend, con persistencia en Postgres y chunks/embeddings en Chroma.

Resultado: ciclo propose → apply → archive completo; se generó la primera spec en `openspec/specs/`.

### Lecciones de la práctica

- **El agente no cierra todo:** dejó sin marcar tareas de pruebas manuales e integración. Las pruebas manuales son del desarrollador; el resto se puede pedir al agente. No archivar con tareas pendientes ni fiarse de un `[x]` sin ejecutar los tests.
- **Límite de body en Express:** `express.json()` acepta 100 kb por defecto. Un PDF de ~640 kb dio `PayloadTooLargeError`. Soluciones: subir el límite solo para la ruta de documentos (antes del parser global) o usar `multipart/form-data` con `multer`. Mantener alineados el límite del backend, el del frontend y la spec.
- **Error de integración generado por el agente:** `extractTextFromBuffer is not a function`; el agente asumió un export que no existía. Revisar los exports reales del módulo y corregir el import. Estos fallos se corrigen con el agente, dentro del cambio abierto; OpenSpec no depura código.
- **Ubicación del root:** `openspec init` se ejecutó dentro de `backend/` y OpenSpec solo funcionaba desde allí (`No OpenSpec root found` en la raíz). Solución: mover `openspec/` y la carpeta del agente a la raíz del repo (basta `mv`, no hace falta repetir `init`) para que las specs cubran frontend y backend. Mejor ejecutar `init` en la raíz desde el principio.
- **`validate` con "Unknown item":** el nombre con prefijo de fecha indica que el cambio ya estaba archivado; `openspec list` mostraba "No active changes".
- **Git:** commitear `openspec/` y la carpeta del agente (aquí `.vibe/`, que solo contenía `skills/`). Comprobar que `.env` y cualquier configuración local del agente que pudiera contener claves queden en `.gitignore`.

## Pendiente / próximo paso

- Leer la spec generada y comprobar que refleja lo implementado (tipos permitidos, límite de tamaño, Postgres y Chroma, y los arreglos posteriores).
- Usar OpenSpec en el siguiente cambio; si se modifica comportamiento existente (RAG, memoria de usuario), escribir antes la spec de esa área.
- Evaluar si el flujo aporta valor en el **Paso 10 (multi-agente)**, que toca varios servicios existentes.
- Probar el mismo flujo con otro agente (Claude Code u otro) y comparar la experiencia.

# Diferencia delta y main SPECS
•  Los main specs son la fuente de verdad del sistema actual
•  Los delta specs son propuestas de cambios que se sincronizan a los main specs durante el archivo
•  Al archivar, los delta specs se convierten en historia (quedan en el archive), pero los main specs representan el estado actual del código