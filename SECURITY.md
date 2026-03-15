# Security Policy

## Supported Versions

This project is under active development. Security fixes are applied to the latest released version on `main`.

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Older releases | Best effort only |

## Reporting A Vulnerability

Do not open a public GitHub issue for a suspected security vulnerability.

Instead:

- email the maintainer if you already have a direct contact path, or
- use GitHub Security Advisories for private reporting if enabled for the repository, or
- if neither is available, open a minimal issue asking for a private contact path without disclosing exploit details

Please include:

- a clear description of the issue
- affected versions or commit range if known
- reproduction steps or a proof of concept
- impact assessment
- any suggested remediation

## What To Expect

- acknowledgment as soon as practical
- an initial triage to confirm severity and scope
- coordination on a fix and disclosure timing when the report is valid

## Security Scope

This repository:

- does not require FDIC API credentials
- should not contain secrets or API keys
- exposes public FDIC data only

Security-sensitive areas still include:

- HTTP transport behavior
- dependency vulnerabilities
- malformed input handling in tool arguments and request parsing
- accidental disclosure through logs or debug output

## Operational Guidance

- Prefer trusted publishing and short-lived credentials for package release workflows.
- Do not commit secrets, tokens, or private endpoints.
- Keep dependencies current and review CI or publishing workflow changes carefully.
