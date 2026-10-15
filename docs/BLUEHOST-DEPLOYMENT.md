# Bluehost FTPS connection test

The workflow currently performs a read-only explicit FTPS test on port 21.
It verifies the TLS certificate, authenticates, encrypts the data channel, and
lists the FTP account root. No files are uploaded, created, overwritten or deleted.
Automatic website publishing is paused during this connection-only test.

Repository Actions secrets required:
- BLUEHOST_HOST: qyg.lxt.mybluehost.me
- BLUEHOST_USER: deploybhgeniesphere@geniesphere.com
- BLUEHOST_FTP_PASSWORD: this FTP account's password

SSH keys, known_hosts, and document-root variables are not used by this test.
The FTP account is scoped to /home2/qyglxtmy/public_html; FTPS sees that as /.
The test verifies access, but does not independently verify domain routing.

Upload .github/workflows/bluehost.yml to main through your GitHub account.
Only this workflow is needed for the test; it does not check out website code.
It starts on a change to that workflow on main and can also be run manually:
Actions > Bluehost FTPS connection test > Run workflow.
Review the connection job's output for PASS lines or the missing-secret names.

On failure the job prints the underlying reason. If the certificate check
fails, a second diagnostic step (no login) prints the subject, issuer, expiry
and subjectAltName names of the server certificate. Set BLUEHOST_HOST to one
of those names. Never disable certificate verification to get a pass.

Status (2026-10-14): the workflow is on main and has run, failing with
SSLCertVerificationError. The runner reaches port 21 and starts TLS, but the
certificate does not validate for qyg.lxt.mybluehost.me (likely a name
mismatch with the server hostname). Login has not been tested yet.
