# Security policy

## Supported versions

Security fixes are applied to the latest release on `main`.

## Reporting a vulnerability

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/larrynode/northstar-life-os/security/advisories/new).
Do not open a public issue with exploit details, personal records, database
contents, private-vault material, credentials, or local paths.

Please include a minimal reproduction using synthetic data, the affected
version, expected impact, and any suggested mitigation. Maintainers will
acknowledge a valid report, investigate it privately, and coordinate disclosure
after a fix is available.

## Security boundaries

- The dashboard is designed for `127.0.0.1` only and rejects non-local hosts
  and origins.
- Northstar assumes the local operating-system account is trusted. It does not
  defend against root access, malware, screen capture, or a compromised account.
- The private vault encrypts entries in the browser. Passphrases and derived
  keys are not stored; forgotten passphrases cannot be recovered.
- The CLI is the supported automation boundary. Generated plans and inferred
  changes require explicit human approval before application.
- Ordinary search and export exclude the private vault. Full backups retain
  ciphertext and should still be handled as sensitive data.
- The project does not require telemetry, cloud accounts, or external services.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the public data-handling model.
