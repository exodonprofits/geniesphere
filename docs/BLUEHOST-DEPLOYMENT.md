# Bluehost deployment (FTPS)

Two workflows share the secrets and trust model below:

- `bluehost.yml` (Bluehost FTPS connection test): read-only. Verifies the TLS
  certificate, authenticates, encrypts the data channel, and lists the FTP
  account root. Uploads, creates, overwrites and deletes nothing.
- `bluehost-deploy.yml` (Bluehost deploy): publishes the site. See "Deploying"
  below.

Repository Actions secrets required:
- BLUEHOST_HOST: qyg.lxt.mybluehost.me (Bluehost > FTP Client Details). It must
  resolve to BLUEHOST_EXPECTED_IP; a different boxNNNN.bluehost.com server will
  reject the login with 530.
- BLUEHOST_USER: deploybhgeniesphere@geniesphere.com
- BLUEHOST_FTP_PASSWORD: this FTP account's password

SSH keys, known_hosts, and document-root variables are not used by this test.
The FTP account is scoped to /home2/qyglxtmy/public_html; FTPS sees that as /.
The test verifies access, but does not independently verify domain routing.

The connection test starts on a change to bluehost.yml on main and can also be
run manually: Actions > Bluehost FTPS connection test > Run workflow.
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

## Deploying

Run Actions > Bluehost deploy > Run workflow on main and pick a mode:

- `dry-run` (default): packages the site, logs in, and prints the plan (new,
  updated, unchanged, and any existing server files that would be replaced).
  Nothing is written.
- `upload`: publishes. Uploads are refused from branches other than main.
- `fetch`: read-only. Downloads the server paths given in `paths`, prints small
  text files to the log, and keeps them as the `bluehost-fetched-<run>`
  artifact (7 days). Use it to inspect live files before replacing them.

What gets published is decided by `scripts/package_site.py`: tracked files under
the public app folders with web file extensions, excluding archive/backup
folders, `shared/vendor/` (except `supabase.min.js`), dotfiles, and n8n workflow
exports (they expose webhook URLs and no page loads them). The file list is kept
as the `bluehost-manifest-<run>` artifact.

`scripts/deploy_bluehost.py` behaviour (ADR-008):

- Add/overwrite only. Server files that are not in the package are never
  deleted, including files removed from the repo. Remove those by hand.
- Each file is uploaded under a temporary `.gs-upload` name and renamed over the
  live file, so visitors never load a half-written file.
- `.gs-deploy-manifest.json` at the site root records the sha256 of every file
  deployed, so unchanged files are skipped. It is publicly readable and lists
  only already-public file paths. Deleting it makes the next deploy compare
  against the server again.
- Existing server files that were not put there by a deploy are downloaded
  before being replaced and kept as the `bluehost-replaced-files-<run>`
  artifact for 90 days.

Status (2026-10-15): the connection test passes (run 15). The FTP root holds 34
existing entries, including an index.html that the first upload will replace.
Run a dry run before the first upload.
