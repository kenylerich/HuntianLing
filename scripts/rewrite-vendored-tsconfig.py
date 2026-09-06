#!/usr/bin/env python3
# Rewrite a vendored cordis-family tsconfig.json in place so that
# `extends` points at the HuntianLing workspace-root synthesised base
# (`.tsconfig.cordis-base.json`) and `composite` is enabled. The
# rewrites are required by tsc -b's project-reference rule: every
# referenced project must be composite.
#
# Run from inside vendor/<pkg>/:
#   python3 ../../scripts/rewrite-vendored-tsconfig.py
#
# The caller captures the original tsconfig.json content first,
# mutates it here, runs tsc, and restores the capture afterwards.

import json
import pathlib
import sys

target = pathlib.Path("tsconfig.json")
cfg = json.loads(target.read_text())
cfg["extends"] = "../../.tsconfig.cordis-base.json"
cfg.setdefault("compilerOptions", {})["composite"] = True
target.write_text(json.dumps(cfg, indent=2) + "\n")
print(f"rewrote {target} extends -> ../../.tsconfig.cordis-base.json, composite=true", file=sys.stderr)
