#!/usr/bin/env python3
# Rewrite a vendored cordis-family tsconfig.json in place so that
# `extends` points at the HuntianLing workspace-root synthesised base
# (`.tsconfig.cordis-base.json`) and `composite` is enabled. The
# rewrites are required by tsc -b's project-reference rule: every
# referenced project must be composite.
#
# Usage:
#   python3 ../../scripts/rewrite-vendored-tsconfig.py [path]
#
# When `path` is omitted, the script operates on `./tsconfig.json` in
# the current working directory (preserving the original call site
# used by earlier iterations of the build script). When `path` is
# given, it rewrites that file in place; this is the form the
# outer-loop batch rewrite uses so cross-package references resolve
# to rewritten siblings before any `tsc -b` runs.
#
# The caller is responsible for capturing the original content and
# restoring it after the build completes.

import json
import pathlib
import sys

target = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "tsconfig.json")
cfg = json.loads(target.read_text())
cfg["extends"] = "../../.tsconfig.cordis-base.json"
cfg.setdefault("compilerOptions", {})["composite"] = True
target.write_text(json.dumps(cfg, indent=2) + "\n")
print(
    f"rewrote {target} extends -> ../../.tsconfig.cordis-base.json, composite=true",
    file=sys.stderr,
)
