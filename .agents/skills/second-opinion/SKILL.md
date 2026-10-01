---
name: second-opinion
description: Independent read-only Codex (GPT-6.1 Sol, high reasoning) investigation run in parallel with the Claude agent that owns the fix. Use whenever an issue or new finding comes up (a test, gate or CI failure, a flaky check, a bug, a review finding, an unexplained timing, an agent's root-cause claim), and to review each fix before it is pushed.
---

# Second opinion

A second opinion is an independent investigation by the Codex CLI. It runs in parallel with the Claude agent that owns the fix and never edits anything. It starts as soon as the issue or finding comes up, and again for each fix before it is pushed.

## Safety

Codex sends everything it reads to OpenAI. Point it only at a fresh detached worktree under `/tmp` that holds sanitized evidence. The main checkout, `e2e/.private`, and real `.env` files stay out of its reach.

## Steps

1. **Build the sandbox.** Create a fresh worktree at the commit under investigation. To review a fix, commit it first and use that commit.

   ```sh
   git worktree add --detach /tmp/<name> <commit>     # fresh copy: no e2e/.private, no real .env files
   ls -a /tmp/<name> | grep '^\.env'                  # only .env.example may exist
   mkdir /tmp/<name>/.codex-evidence                  # copy in ONLY the failure evidence needed (e.g. progress.json error excerpts)
   ```

   Done when the `.env` check lists only `.env.example` and `.codex-evidence` holds only sanitized excerpts.

2. **Write the prompt.** It must contain:
   - that the task is READ-ONLY;
   - the symptom and the evidence file under `.codex-evidence`;
   - the relevant files and lines;
   - the candidate causes and the questions to answer;
   - for a fix review, the commit or diff range and a request for a verdict: "sound / needs change";
   - a cap on answer length (for example 300 words).

3. **Run Codex as a background task from the start.** Always pass the model and effort: the user's `~/.codex/config.toml` defaults to another model with low reasoning. Always redirect stdin from `/dev/null`: a foreground run moved to the background sat at "Reading additional input from stdin…" until it timed out.

   ```sh
   codex exec -m gpt-6.1-sol -c model_reasoning_effort=high --sandbox read-only --ephemeral \
     -C /tmp/<name> -o <answer-file> "<prompt>" < /dev/null
   ```

   Keep `<answer-file>` outside the worktree. If a call fails, confirm `gpt-6.1-sol` is listed by `codex debug models`.

4. **Weigh the result.** Relay Codex's findings to the owning agent as leads to verify with evidence, and compare both accounts before deciding. Codex has been wrong (a font-swap theory that evidence refuted) and has caught real defects that tests missed. Iterate until only theoretical points remain, then bring those to the user.

5. **Clean up.** Done when all of these have run:

   ```sh
   git worktree remove --force /tmp/<name>
   rm <answer-file> <log-files>
   git worktree prune
   ```
