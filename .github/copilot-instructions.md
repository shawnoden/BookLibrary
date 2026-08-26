# Copilot workflow

For any requested code or documentation change, use this Git workflow unless the user explicitly chooses another one:

1. Start from an up-to-date `main` checkout. If the worktree has unrelated uncommitted changes, preserve them and ask before switching branches.
2. Create a feature branch named `copilot/<short-kebab-case-description>` before editing.
3. Make the smallest focused change and run the narrowest relevant validation. Run `git diff --check` as a final formatting check.
4. Commit the completed change on the feature branch with a detailed imperative subject and body. The body should explain the problem, the implementation, and validation performed.
5. Push the feature branch to `origin`.
6. Switch to `main`, update it without discarding work, merge the feature branch, and push `main` to `origin`.
7. Report the branch name, commit hash and message, validation result, and push/merge result.

Never discard existing user changes, force-push, rewrite history, or silently resolve a merge conflict. Stop and ask for a decision if the worktree is dirty in a way that affects the requested change, the branch cannot be created safely, validation fails, authentication is required, or the merge conflicts.
