/**
 * HuntianLing host entry.
 *
 * Re-exports the root plugin so that `cordis.yml` and external consumers can
 * resolve `@kenylerich/dsh-huntianling` and `@kenylerich/dsh-huntianling/host`
 * through a single source of truth.
 */

export { default, default as huntianling } from './host/plugin.js';
