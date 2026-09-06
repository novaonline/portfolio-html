# Maintenance status

The website and editorial workflow use the same documented commands with or without Codex. Run `npm run verify` for format, types, deterministic tests and production output; run `npm run test:browser` for browser behaviour. Private deployment additionally checks every served byte against its retained artifact.

On 2026-09-06, `npm audit` reports 14 dependency advisories: 2 high, 9 moderate and 3 low. The high advisories are in Astro 5 and its Sharp dependency. The suggested complete framework fix is a major upgrade to Astro 7; that migration is outstanding. Compatible lockfile updates have been applied. Do not confuse a passing build with an advisory-free dependency tree, or apply `npm audit fix --force` without reviewing the framework and MDX migration.

The deployed site serves static files; this workflow does not deploy an Astro server. Review the individual advisories against that deployment and build-time image processing when planning the upgrade. The Firebase CLI also contributes transitive development-tool advisories.

Dependency evidence: [Astro advisory](https://github.com/advisories/GHSA-8hv8-536x-4wqp), [Sharp advisory](https://github.com/advisories/GHSA-f88m-g3jw-g9cj). Dependabot is configured to propose updates.
