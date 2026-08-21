"""Static integrity check: no function references a module-level name that isn't there.

WHY THIS EXISTS. Extracting the research endpoints out of `rag_api.py` by LINE
RANGE also removed `_IDENTITY_PATTERNS` and `_IDENTITY_REDIRECT`, which lived
inside that range but were used by `/api/ask`. Result: every single call to
`/api/ask` and `/api/socratic` returned a 500. **All 173 tests passed the whole
time**, because no test ever executed that code path — the tutor needs chromadb +
Ollama, so it isn't reachable from a stdlib test suite.

So the lesson isn't "pin those two constants". It's that a NameError inside a
rarely-executed branch is invisible to a test suite that cannot execute it, and a
whole class of edits (line-range extraction, moving a block between modules,
deleting a "dead" constant) produces exactly that failure. This walks the AST
instead of running the code, so it covers every module including the ones whose
imports we can't satisfy here.

It is a linter, not a proof: it cannot see names injected at runtime. It catches
the deletion case, which is the one that has actually bitten.
"""

import ast
import builtins
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)

_BUILTINS = set(dir(builtins)) | {"__file__", "__name__", "__doc__", "__spec__", "__package__"}

# Modules that are scratch/dev, not part of the shipped surface.
SKIP = {"_devserver.py", "check_db.py", "rag_api_mock.py", "rag_api_simple.py", "rag_app.py"}


def _bound_by(node) -> set:
    """Every name this statement/expression BINDS, not descending into nested scopes."""
    out = set()
    for n in ast.walk(node):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            out.add(n.name)
        elif isinstance(n, ast.Name) and isinstance(n.ctx, (ast.Store, ast.Del)):
            out.add(n.id)
        elif isinstance(n, ast.arg):
            out.add(n.arg)
        elif isinstance(n, (ast.Import, ast.ImportFrom)):
            for a in n.names:
                out.add((a.asname or a.name).split(".")[0])
        elif isinstance(n, ast.ExceptHandler) and n.name:
            out.add(n.name)
        elif isinstance(n, (ast.Global, ast.Nonlocal)):
            out.update(n.names)
    return out


def undefined_globals(path: str) -> list:
    """-> [(lineno, name, function)] for Load-context names with no visible binding."""
    with open(path, encoding="utf-8") as fh:
        tree = ast.parse(fh.read(), filename=path)

    module_scope = _bound_by(tree)
    problems = []

    def visit_scope(fn, enclosing: set):
        # Everything bound anywhere in this function is visible throughout it
        # (Python binds per-function, not per-line), plus comprehension targets,
        # which we deliberately fold in rather than modelling their own scope --
        # erring toward silence, since a false alarm here is worse than a miss.
        local = _bound_by(fn)
        visible = enclosing | local | module_scope | _BUILTINS

        for n in ast.walk(fn):
            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load):
                if n.id not in visible:
                    problems.append((n.lineno, n.id, getattr(fn, "name", "<lambda>")))

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            visit_scope(node, set())

    # De-dup: one report per (name, function) is enough.
    seen, unique = set(), []
    for lineno, name, fn in problems:
        if (name, fn) not in seen:
            seen.add((name, fn))
            unique.append((lineno, name, fn))
    return unique


def run() -> int:
    failures = 0
    checked = 0
    passed = 0

    modules = sorted(f for f in os.listdir(BACKEND)
                     if f.endswith(".py") and f not in SKIP)
    for fname in modules:
        path = os.path.join(BACKEND, fname)
        try:
            bad = undefined_globals(path)
        except SyntaxError as e:
            print(f"  FAIL {fname}: does not parse -- {e}")
            failures += 1
            continue
        checked += 1
        if not bad:
            passed += 1
        for lineno, name, fn in bad:
            print(f"  FAIL {fname}:{lineno} {fn}() references undefined name '{name}'")
            failures += 1

    print(f"  checked {checked} of {len(modules)} backend modules for undefined globals")

    # The specific pin. Belt and braces: the AST walk above would catch a deletion
    # of these, but naming them makes the regression legible to whoever reads the
    # test after the next incident.
    rag = os.path.join(BACKEND, "rag_api.py")
    with open(rag, encoding="utf-8") as fh:
        tree = ast.parse(fh.read())
    top = _bound_by(tree)
    for const in ("_IDENTITY_PATTERNS", "_IDENTITY_REDIRECT"):
        if const in top:
            passed += 1
        else:
            print(f"  FAIL rag_api.py lost module-level {const} "
                  f"(this exact deletion broke every /api/ask call once)")
            failures += 1
    print("  regression pin: _IDENTITY_PATTERNS + _IDENTITY_REDIRECT present at module level")

    print(f"{passed} passed, {failures} failed")
    return failures


if __name__ == "__main__":
    sys.exit(1 if run() else 0)
