# native/landlock-run — placeholder

> **HUNTIANLING_PROBE_STUB**

HuntianLing is a *consumer* of the host dsh harness's landlock-run sandbox,
not a *producer* of one. The `native/landlock-run/` directory exists in
the dsh repo because the host ships the sandbox as a node addon; HuntianLing
never builds it.

This directory is kept as an empty placeholder so that the dsh-copied
`landlock-run.yml` workflow (which sets `working-directory: native/landlock-run`)
does not fail with "No such file or directory" while we evaluate which
workflows apply to HuntianLing.

When the host dsh repo graduates the landlock-run source into a published
artifact, drop this directory and remove the dsh-copied `landlock-run.yml`
workflow from this repository's `.github/`.
