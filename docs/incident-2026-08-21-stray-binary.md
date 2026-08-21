# Stray Linux binaries in `frontend/` — found 2026-08-21

Found while orienting for the revamp close-out. Recording it because one of them is
in the pushed GitHub history and the decision to rewrite that history is Wilson's.

## What was found

Two **different** UPX-4.00-packed, statically linked **Linux x86-64 ELF** binaries, plus
one transfer artefact, all sitting in `frontend/`:

| Path | Size | mtime | State |
|---|---|---|---|
| `frontend/let;chmod` | 1,442,156 B | 2026-08-19 01:45 | tracked; worktree copy **differs** from the committed one |
| `frontend/let` | 1,309,300 B | 2026-06-19 03:54 | untracked; same size as the *committed* `let;chmod` blob |
| `frontend/.b` | 335 B | 2026-08-17 01:18 | untracked; a Python `http.server` **404 page** |

The committed one entered in **`6987bcc`, 2026-06-18, titled "Increase font sizes for
game readability"** — a commit that also carried `frontend/let` (0 bytes), `dev.log`
(+6883 lines), `dev-fresh.log`, and the Playwright audit scripts. It is present on
`origin/master` **and** `origin/feat/topic-session-revamp`.

## What is known vs. not known

**Known.** Both are UPX 4.00 packed (banner string intact); the packheader puts the
committed one at ~4.33 MB uncompressed. Both are ELF — they **cannot execute on Windows**
natively; only WSL could run them. Nothing anywhere in this repo references, downloads, or
invokes either file. `.b` is what you get when a client requests a path from a
`python -m http.server` that does not exist — i.e. residue of a **file transfer**, not of a build.

**Not known.** What they are. Identifying them means unpacking and reading a binary of
unknown provenance, which was not done deliberately. The filename `let;chmod` alongside a
0-byte `let` is the shape of a mangled `... -O let; chmod +x let` one-liner, which is
consistent with an accident — but that is an inference, not evidence.

**The part that is not explained by a June accident:** `frontend/let;chmod` was *overwritten
with a different binary* on **2026-08-19**, and `.b` was written **2026-08-17**. Both dates
are after the revamp work started, and 08-19 is the night a prior Claude session on this repo
terminated without finishing.

## What was done

- All three **moved to the session scratchpad** (`scratchpad/quarantine/`), not deleted —
  evidence preserved, repo clean.
- `frontend/let;chmod` untracked (`git rm --cached`), so it leaves `HEAD` going forward.
- `.gitignore` rules added so a re-download cannot be committed silently again.

## What is Wilson's call

1. **Is `github.com/wilson-cheng1110/compgame-fyp` public?** If yes, an unidentified packed
   binary has been publicly downloadable from the repo since 2026-06-18. That changes the
   urgency; nothing else here does.
2. **History rewrite.** Removing it from `HEAD` does not remove it from history. Purging needs
   `git filter-repo --path 'frontend/let;chmod' --invert-paths` plus a **force push** to both
   branches — destructive, and not done without an explicit instruction.
3. **Identification.** If it matters, submit the SHA-256 to VirusTotal (hash only — do not
   upload the file, it may carry repo context):
   `e7ed560665ec93e02779d4b62db73ff7914b1b631330ce31df756e41047af4c7` (the 1,442,156 B one).
4. **Did you put them there?** If this was a deliberate transfer of a Linux tool between your
   machines, the answer is "ignore all of the above" and the ignore rules still stand.
