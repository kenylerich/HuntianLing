# vendor/

This directory holds the cordis family packages that HuntianLing's
host plugin imports (`@deepseek-ai/cordis`, `@deepseek-ai/cordis-plugin-include`,
`@deepseek-ai/cordis-plugin-loader`, `@deepseek-ai/cosmokit`). They are
copied verbatim from the host dsh repo at
[`deepseek-harness/vendor/`](https://github.com/kenylerich/deepseek-harness/tree/master/vendor).

## Why vendored, not published

The cordis family is not yet published to npm; the host dsh repo
sources it from its own `vendor/` tree. HuntianLing cannot consume
unpublished packages via `npm install` without a private registry,
so it vendors the same four packages in this repo. pnpm-workspace.yaml
links them so the `workspace:^` references inside cordis resolve.

## Sync procedure

1. From the host dsh repo, copy the four `vendor/{cordis,cosmokit,include,loader}/`
   directories into this `vendor/` directory.
2. Each `tsconfig.json` extends `../../tsconfig.base.json`, which only
   lives in the host dsh repo. The vendored tsconfigs are
   deliberately left untouched; the CI workflow synthesises a
   minimal `tsconfig.base.json` at build time and rewrites the
   `extends` path before running `tsc -b`.
3. Do not commit the `lib/` build outputs; they are produced by
   `tsc -b` in CI and are ignored by `.gitignore` (the trailing
   `lib/` rule).

## Removing the vendor/

Once the cordis family publishes a stable version, drop this
directory, drop `pnpm-workspace.yaml`, and pin
`@deepseek-ai/cordis` (and friends) to that version in `package.json`.
This is the long-term path; today the cordis family is an
unpublished internal of the dsh repo.
