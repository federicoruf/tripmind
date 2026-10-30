---
name: create-pr
description: Creates a branch named after the active OpenSpec change, commits, opens a draft PR on GitHub, and moves the Jira ticket to In Review
user-invocable: true
---

Follow these steps in order. Stop and ask me if any step is unclear.

## 1. Find the OpenSpec change and the Jira ticket
- Run `openspec list` to see active changes in `openspec/changes/`.
- If there is exactly one active change, use its name as `<spec-name>`.
- If there are several, ask me which one to use.
- If there are none, look in `openspec/changes/archive/` for the most
  recent folder and remove the `YYYY-MM-DD-` prefix to get `<spec-name>`.
- Open `proposal.md` inside that change folder
  (`openspec/changes/<spec-name>/proposal.md`, or the matching folder
  in `openspec/changes/archive/` if the change was archived).
- Find the line that starts with `Jira:`. The value after it is the
  ticket key (for example `SCRUM-5`).
- If the file or the line does not exist, or the value is empty,
  ask me for the key. Do not guess.

## 2. Create the branch
- Run `git status`.
- If I am on `main`, create the branch with `git switch -c feat/<spec-name>`.
  My local changes move with it.
- If I am already on a `feat/` branch, keep using it.
- Never push to `main`.

## 3. Review before committing
- Show me `git diff --stat` and wait for my confirmation.
- Do not include `.env`, logs, or any file with secrets.

## 4. Plan, commit and push
- Before committing, group the changed files by purpose. Example groups:
  database/migrations, backend services, routes, frontend components,
  tests, docs, OpenSpec files.
- Show me the plan: a list of commits, each with its message and the
  files it includes. Wait for my confirmation.
- Create one commit per group using `git add <specific files>`.
  Never use `git add .`, `git add -A` or `git commit -a`.
- Commit message format: `type: short summary` (feat, fix, docs, test,
  chore), maximum 72 characters.
- Keep tests in the same commit as the code they test.
- Do NOT put everything in a single commit, unless all the changes
  have one single purpose or there are fewer than 3 changed files.
- Push the branch.

## 5. Open the PR (GitHub MCP)
- Open it as a **draft**.
- Title: short and based on `proposal.md` of the change.
- Description:
  - What changed
  - Why (summarize `proposal.md`)
  - How to test it
  - What is out of scope
  - Jira ticket key (from step 1)

## 6. Update Jira (Jira MCP)
- Use the Jira MCP to get the available transitions for the ticket
  key found in step 1.
- Move the ticket to **In Review**. Use only the transition named
  "In Review". If it is not available, tell me which transitions exist
  and do not change anything.

## 7. Report
- Give me the PR link and confirm the new Jira status.