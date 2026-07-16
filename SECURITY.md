# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Beacon, please report it privately
via [GitHub Security Advisories](https://github.com/martin-k-m/beacon/security/advisories/new)
rather than opening a public issue.

Please include:

- a description of the vulnerability and its impact,
- steps to reproduce, and
- any relevant logs or proof-of-concept.

We aim to acknowledge reports within a few days and will keep you updated on
remediation progress.

## Scope

Beacon only performs **read** operations against the public GitHub REST API and
never writes to analyzed repositories. When self-hosting, treat your
`GITHUB_TOKEN`, database credentials, and AI provider keys as secrets — configure
them via environment variables and never commit them.

## Supported versions

Security fixes are applied to the latest release and the `main` branch.
