# Bluehost FTPS connection test

The workflow currently performs a read-only explicit FTPS test on port 21.
It verifies the TLS certificate, authenticates, encrypts the data channel, and
lists the FTP account root. No files are uploaded, created, overwritten or deleted.
Automatic website publishing is paused during this connection-only test.

Repository Actions secrets required:
- BLUEHOST_HOST: the server hostname, e.g. boxNNNN.bluehost.com (cPanel > FTP
  Accounts > Configure FTP Client). The FTP certificate is *.bluehost.com, so
  qyg.lxt.mybluehost.me and ftp.geniesphere.com fail verification.
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

Before connecting, the job prints a shape check of BLUEHOST_HOST (length,
whitespace, scheme/path/port characters, part count, and whether it matches
*.bluehost.com) without revealing the value.

On failure the job prints the underlying reason. If the certificate check
fails, a second diagnostic step (no login) prints the subject, issuer, expiry
and subjectAltName names of the server certificate. Set BLUEHOST_HOST to one
of those names. Never disable certificate verification to get a pass.

Status (2026-10-15): runs fail with "Hostname mismatch". The server presents a
Sectigo certificate for *.bluehost.com / bluehost.com (valid to 2027-01-06).
BLUEHOST_HOST must be a single label in front of .bluehost.com. Login has not
been tested yet.
