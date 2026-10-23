# Documentation Standards

## Purpose and Scope

This document defines how TripMind documentation is written, reviewed, updated, and governed. It applies to every project-facing document, including:

- The root README and setup instructions.
- API contracts in documentation/api-spec.yml.
- Architecture, deployment, security, frontend, and backend standards.
- OpenSpec proposals, designs, tasks, and specifications.
- Operational documentation, runbooks, database migration notes, and CI/CD documentation.
- Documentation comments in production source code when they explain behaviour, constraints, or security decisions.

It does not replace source code, tests, or API validation. Documentation must describe the system accurately and link to the relevant source of truth.

## Core Principles

- Write all new and updated technical documentation in English.
- Make statements factual, specific, and verifiable. Do not invent configuration, endpoints, provider capabilities, deployment steps, or operational status.
- When required information is unavailable, mark it as unknown or ask the project owner for it before documenting it as fact.
- Prefer the source of truth over copied detail. Link to the API specification, SQL script, configuration file, or implementation where appropriate.
- Keep documentation proportional to the change. Update only the documents affected by a behaviour, contract, architecture, configuration, or workflow change.
- Explain why a non-obvious decision exists, not merely what the code says.
- Treat documentation as a maintained product asset: it must be readable, current, secure, and reviewed with the code it describes.

## Documentation Sources of Truth

| Subject | Source of truth |
| --- | --- |
| Public HTTP API and SSE events | documentation/api-spec.yml |
| Backend standards | documentation/backend-standards.md |
| Frontend standards | documentation/frontend-standards.md |
| Production topology and operational configuration | documentation/deployment.md |
| Project setup and high-level architecture | README.md |
| Behavioural change proposals and acceptance criteria | openspec/ |
| Database schema changes | backend/script_sql/ and the matching change documentation |
| Frontend deployment configuration | frontend/firebase.json and GitHub Actions workflows |
| Backend runtime configuration | backend source, deployment configuration, and documented environment variables |

When two documents disagree, correct the outdated document in the same change. Do not silently leave a contradiction for a later task.

## Writing and Formatting Standards

- Use clear, direct English and consistent terminology. Define abbreviations on first use when they may be unfamiliar, such as Server-Sent Events (SSE) or retrieval-augmented generation (RAG).
- Use descriptive Markdown headings in a logical hierarchy. Do not skip heading levels.
- Include a table of contents only for long documents where it improves navigation; use working anchor links.
- Use fenced code blocks for commands, configuration, payloads, and file trees. Label executable code blocks with their language when applicable.
- Use tables for stable comparisons, configuration matrices, and component ownership. Do not force long prose into tables.
- Use relative links for repository documents and meaningful labels for local file links.
- Keep line length readable and use one blank line around headings, lists, code blocks, and tables.
- Preserve established terminology and filenames. Do not rename a document solely for stylistic preference.
- Write dates only when they are relevant to an operational record or migration; use ISO 8601 format (YYYY-MM-DD).
- Keep screenshots, tokens, credentials, personal data, production database URLs, and proprietary document content out of documentation.

## Documentation Update Process

Before completing a code, configuration, infrastructure, or operational change, review its documentation impact.

1. Inspect the changed files and identify externally observable, architectural, security, data, setup, dependency, and deployment effects.
2. Map each effect to its documentation source of truth.
3. Update every affected document in English and keep terminology consistent.
4. Add or update examples, schemas, commands, and environment-variable tables only when they match the implementation.
5. Validate Markdown formatting, links, commands, and structured documents such as OpenAPI YAML.
6. Report the files updated, the reason for each change, and any intentionally unresolved documentation gap.

At minimum, consider the following mapping:

| Change type | Documentation to review |
| --- | --- |
| API endpoint, payload, status code, SSE event, or authentication change | api-spec.yml, README, Bruno requests where applicable |
| Backend architecture, provider, RAG, database, or security change | backend-standards.md, deployment.md, README |
| Frontend interaction, Auth0, environment, API usage, or hosting change | frontend-standards.md, README, deployment.md |
| Database schema or migration change | SQL script documentation, README setup, deployment.md, OpenSpec |
| Dependency, build, test, or development-script change | README and the relevant frontend/backend standards |
| Deployment provider, URL, secret, CORS, cron, or CI/CD change | deployment.md, README, api-spec.yml if its servers or operational contract change |
| User-visible behaviour change | OpenSpec, README when relevant, and the API contract if the interface changes |

## API Documentation

- Update documentation/api-spec.yml in the same change as every public API contract change.
- Document paths, HTTP methods, authentication, request bodies, parameters, success responses, failure responses, limits, and examples.
- Document every SSE event name, payload, ordering or terminal semantics, and error behaviour.
- Keep the OpenAPI server list aligned with the supported local and production URLs. Do not publish temporary preview URLs as production servers.
- Do not describe an endpoint as available until its route and response behaviour exist in the application. If configuration expects a missing capability, document it as a pending requirement rather than as a fact.
- Keep API examples free of real tokens, user data, production secrets, and private document content.

## Configuration, Deployment, and Security Documentation

- Document the purpose of each required environment variable, but never its secret value.
- Clearly separate local-development values, production values, and placeholders.
- When deployment changes, update the provider, runtime, build/start commands, public URL, database provider, CORS origin, scheduled jobs, and cold-start characteristics if applicable.
- State only verified operational facts. If a setting is described as expected rather than confirmed, label it accordingly.
- Document the owner, trigger, authentication mechanism, retry behaviour, and failure outcome for every scheduled or background operation.
- Security documentation must state trust boundaries, authentication, authorization, input limits, encryption behaviour, retention, and data deletion semantics when those features are affected.
- Never weaken a security description to hide an implementation gap. Record the gap and its required resolution precisely.

## OpenSpec and Change Documentation

Use OpenSpec for changes that alter behaviour, requirements, or externally observable contracts.

- A proposal explains the problem, scope, impact, and non-goals.
- A design records consequential implementation decisions and alternatives when they affect maintainability, security, data, or operations.
- Specifications state testable requirements and acceptance criteria.
- Tasks are concrete, ordered, and reflect implementation and verification work.
- Archive a completed change only when its implementation, tests, API contract, and relevant operational documentation agree.
- Keep documentation for active work separate from historical archives; do not revise archived decisions to conceal their historical context.

## Quality Checklist

Before handing off documentation, verify:

- The content is in English and uses consistent terminology.
- Every claim matches code, configuration, or verified project-owner input.
- No password, token, API key, secret, personal data, or sensitive uploaded content is included.
- Links and referenced paths are valid.
- Commands are safe, scoped, and identify their required context.
- Environment-variable names and URLs match the active configuration.
- API documentation matches the implemented response and error contract.
- Markdown has no broken hierarchy, malformed fences, trailing whitespace, or inconsistent tables.
- The change does not overwrite unrelated user edits.

## AI Specification and Feedback Governance

AI-facing rules and standards are project documentation. They guide planning, implementation, testing, documentation, and collaboration, but they do not override explicit user instructions.

After every interaction that contains feedback, correction, preference, new project information, or an operational decision, the AI must consider whether a documentation or standards update is warranted. The review must be feedback-driven and narrowly scoped.

When a rule update may help, the AI must:

1. Identify the specific feedback or fact that motivates the proposed change.
2. Name the exact document and section that would change.
3. Explain the expected benefit and any trade-off.
4. Request explicit user approval before editing an existing standard or AI

   rule.
5. Apply only the approved, connected change.
6. Report the completed update and its location.

The AI must not modify standards proactively when no direct connection exists to feedback or a verified project change. It must not bundle unrelated rule changes, silently rewrite project conventions, or claim that a proposed rule is already active before approval.

## Maintenance Responsibilities

Documentation maintenance is part of completing a change, not a follow-up activity. If documentation cannot be updated because information is missing, record the specific gap in the handoff and request the missing fact. Do not substitute assumptions for owner confirmation.
