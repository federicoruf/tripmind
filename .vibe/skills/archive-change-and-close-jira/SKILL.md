---
name: archive-change-and-close-jira
description: Finishes an OpenSpec change after its PR is merged. Switches to main and pulls, runs the existing openspec-archive-change workflow as it is, and moves the Jira ticket to Done. Use when I say "close the change", "finish the spec", "archive and close the ticket", or when a change is implemented and merged and needs to be archived.
user-invocable: true
---

This skill wraps the existing `openspec-archive-change` skill. It adds git
and Jira steps around it. Do NOT copy, rewrite or skip any step of
`openspec-archive-change`: run that skill as it is and follow it fully,
including its questions and confirmations.

Follow these steps in order. Stop and ask me if any step is unclear.

## 1. Check the working tree
- Run `git status --porcelain`.
- If there are uncommitted changes, stop and show them to me. Do not
  stash, commit or discard anything.

## 2. Find the change and the Jira ticket
- Get `<spec-name>` from the current branch name (`feat/<spec-name>`).
- If the current branch is not a `feat/` branch, run `openspec list --json`
  and ask me which change to use.
- Open `openspec/changes/<spec-name>/proposal.md` and find the line that
  starts with `Jira:`. The value after it is the ticket key
  (for example `SCRUM-5`).
- If the file or the line does not exist, or the value is empty, ask me
  for the key. Do not guess.
- Do this before archiving, because archiving moves the change folder.

## 3. Check the PR (GitHub MCP)
- Find the PR for the current branch. If there is none, tell me and stop.
- If the PR is already merged, go to step 4.
- If it is NOT merged, check these things and show me a short report:
  - **Unresolved review threads:** list each one with its author, file
    and a one-line summary (include CodeRabbit comments).
  - **Checks:** the status of CI and any required checks.
  - **Draft state:** if the PR is a draft, tell me it must be marked as
    ready for review before it can be merged.
- Then ask me if I want you to merge it. Merge only if I answer yes.
  - If there are unresolved threads or failing checks, warn me clearly
    and recommend not merging. Ask again separately before continuing.
  - Ask me which merge method to use (merge, squash or rebase). Do not
    choose it yourself.
  - Never resolve threads, dismiss reviews, or skip checks to make the
    merge possible.
  - Do not delete the branch after merging.
- If I say no to merging, ask if I want to continue anyway.
  If I say no, stop.
  
## 4. Switch to main and update it
- Run `git switch main`.
- Run `git pull --ff-only`.
- If either command fails, stop and show me the error. Never use
  `--force` or `git reset`.
- Check that `openspec/changes/<spec-name>/` exists on `main`. If it does
  not, stop and tell me.

## 5. Archive the change
- Run the `openspec-archive-change` workflow for `<spec-name>`, passing
  the name so it does not ask me to select a change.
- If it stops, fails, or I cancel it, stop here. Do not touch Jira.

## 6. Update Jira (Jira MCP)
- Only do this if step 5 finished successfully.
- Use the Jira MCP to get the available transitions for the ticket key
  found in step 2.
- Move the ticket to **Done**. Use only the transition named "Done".
  If it is not available, tell me which transitions exist and do not
  change anything.

## 7. Report
- Show the archive summary from `openspec-archive-change`.
- Confirm the current branch (`main`) and the new Jira status.
- Run `git status --short` and list any files left modified by the
  archive. Do NOT commit or push them. Never push to `main`.