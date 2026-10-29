---
name: create-pr
description: Creates a branch named after the active OpenSpec change, commits, opens a draft PR on GitHub, and moves the Jira ticket to In Review
user-invocable: true
---

Follow these steps in order. Stop and ask me if any step is unclear.

## 1. Find the OpenSpec change name
- Run `openspec list` to see active changes in `openspec/changes/`.
- If there is exactly one active change, use its name as `<spec-name>`.
- If there are several, ask me which one to use.
- If there are none, look in `openspec/changes/archive/` for the most
  recent folder and remove the `YYYY-MM-DD-` prefix to get `<spec-name>`.

## 2. Create the branch
- Run `git status`.
- If I am on `main`, create the branch with `git switch -c feat/<spec-name>`.
  My local changes move with it.
- If I am already on a `feat/` branch, keep using it.
- Never push to `main`.

## 3. Review before committing
- Show me `git diff --stat` and wait for my confirmation.
- Do not include `.env`, logs, or any file with secrets.

## 4. Commit and push
- Make small commits with clear messages (feat:, fix:, docs:, test:).
- Push the branch.

## 5. Open the PR (GitHub MCP)
- Open it as a **draft**.
- Title: short and based on `proposal.md` of the change.
- Description:
  - What changed
  - Why (summarize `proposal.md`)
  - How to test it
  - What is out of scope
  - Jira ticket key (if found in step 6)

## 6. Update Jira (Jira MCP)
- Open `.openspec.yaml` inside the change folder found in step 1
  (`openspec/changes/<spec-name>/.openspec.yaml`, or the matching folder
  in `openspec/changes/archive/` if the change was archived).
- Read the value of the `jira:` field. That value is the ticket key.
- If the file or the `jira:` field does not exist, or the value is empty, ask me for the key. Do not guess.
- Use the Jira MCP to get the available transitions for that ticket.
- Move the ticket to **In Review**. Use only the transition named
  "In Review". If it is not available, tell me which transitions exist
  and do not change anything.

## 7. Report
- Give me the PR link and confirm the new Jira status.