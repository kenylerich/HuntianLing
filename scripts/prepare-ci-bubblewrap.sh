#!/usr/bin/env bash
# HUNTIANLING_PROBE_STUB
#
# HuntianLing does not need a CI bubblewrap sandbox (the host dsh harness
# already manages landlock/bwrap in its own CI; the plugin is consumed by
# it, not the source of it). This stub exists only so that the
# dsh-copied sandbox.yml and ci-master.yml workflows step past the line
# `bash scripts/prepare-ci-bubblewrap.sh` while we evaluate which
# workflows are even appropriate for HuntianLing.
#
# It is intentionally empty and exits 0. See LOCAL_DEV_NOTES.md and the
# GitHub workflow probe history in commit messages for the rationale.

exit 0
