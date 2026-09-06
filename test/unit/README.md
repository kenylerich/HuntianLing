# Unit tests

This directory will hold `*.test.mjs` files run by `pnpm run test`
(`node --test test/unit/*.test.mjs`). The directory is intentionally
empty while the HuntianLing Service implementations are still
skeletons; unit tests will land alongside the first real Service
that has shape worth covering.

The directory itself is checked in so the test glob resolves before
any tests exist — without it, `node --test test/unit/*.test.mjs` fails
with "No matching files", which is a different (and less honest)
failure mode than "no tests yet".
