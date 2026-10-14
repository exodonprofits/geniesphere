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

The connected GitHub integration returned 403 Resource not accessible by
integration when attempting to create the workflow. No remote workflow was
created by that attempt, and no real connection test has run yet.
