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
- Run `git diff --name-only` and `git status --short` to list all changes.
- Group the files by LAYER, not by feature. Use these groups, in this order,
  skipping the ones with no files:
  1. database / migrations
  2. backend (services, routes, middleware)
  3. frontend
  4. docs and OpenSpec files
  5. config / chore
- Tests go in the same commit as the code they test.
- Show me the plan: each commit with its message and files.
  Wait for my confirmation. Do not run `git commit` before I confirm.
- Create one commit per group using `git add <specific files>`.
  Never use `git add .`, `git add -A` or `git commit -a`.
- Commit message format: `type: short summary` (feat, fix, docs, test,
  chore), maximum 72 characters.
- Only exception: if there are fewer than 3 changed files, one commit
  is fine. Having a single feature or a single OpenSpec change is NOT
  a reason to use one commit.
- Before pushing, run `git log --oneline main..HEAD`.
  If there is only 1 commit and there were 3 or more changed files,
  run `git reset --soft main`, `git reset`, and redo the commits
  following the plan.
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