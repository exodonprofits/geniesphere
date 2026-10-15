# Bluehost FTPS connection test

The workflow currently performs a read-only explicit FTPS test on port 21.
It verifies the TLS certificate, authenticates, encrypts the data channel, and
lists the FTP account root. No files are uploaded, created, overwritten or deleted.
Automatic website publishing is paused during this connection-only test.

Repository Actions secrets required:
- BLUEHOST_HOST: qyg.lxt.mybluehost.me (Bluehost > FTP Client Details). It must
  resolve to BLUEHOST_EXPECTED_IP; a different boxNNNN.bluehost.com server will
  reject the login with 530.
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

It then resolves BLUEHOST_HOST and stops before login unless it points at the
server IP from Bluehost > FTP Client Details (50.6.156.176, set as
BLUEHOST_EXPECTED_IP in the workflow's job env).

Certificate trust (see ADR-007 in DECISIONS.md): the server presents Bluehost's
shared *.bluehost.com certificate, and none of its hostnames are covered by it.
The job therefore connects to BLUEHOST_EXPECTED_IP and verifies the certificate
chain against the fixed name bluehost.com (BLUEHOST_CERT_NAME). The certificate
proves a genuine Bluehost server; the IP pin proves it is this account's server.
Update BLUEHOST_EXPECTED_IP if Bluehost moves the account to another server.

On failure the job prints the underlying reason. A second diagnostic step (no
login) prints the subject, issuer, expiry and subjectAltName names of the
certificate served at BLUEHOST_EXPECTED_IP. Never disable certificate
verification to get a pass.

Status (2026-10-15): the 530 login failures were caused by BLUEHOST_HOST
pointing at another Bluehost server (50.87.248.234). With BLUEHOST_HOST set back
to qyg.lxt.mybluehost.me and the trust model above, login has not been tested
yet.
