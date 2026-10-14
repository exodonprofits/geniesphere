# Bluehost upload from GitHub

This workflow packages public files and uploads them only when manually started
on main with preview_only unchecked. Existing files with matching paths are
overwritten; other server files are retained. Back up the existing website first.
The current index.html is the starter homepage: uploading it replaces your live homepage.

## Bluehost setup

1. Open Websites > Manage > Files & Access. Confirm the document root for geniesphere.com.
   Use the exact absolute directory, for example /home/ACCOUNT/public_html.
2. Enable SSH access. Confirm the server hostname, account username and SSH port.
3. Create a dedicated SSH key and authorize its public key in Bluehost.
   Store the private key only in GitHub secrets, never in this repository.
4. Confirm SSH login works and tar is available on the server.
5. Obtain the server host key and verify its fingerprint with Bluehost before trusting it.
   A known_hosts line uses HOST for port 22 or [HOST]:PORT for other ports.

## GitHub setup

Open Settings > Environments and create bluehost. Add environment secrets:

- BLUEHOST_HOST: Bluehost server hostname or IP.
- BLUEHOST_USER: Bluehost account username.
- BLUEHOST_SSH_KEY: complete private key, without a passphrase, including header/footer.
- BLUEHOST_KNOWN_HOSTS: verified SSH known_hosts entry for that server.

Add environment variables:

- BLUEHOST_DOCUMENT_ROOT: exact absolute domain document root.
- BLUEHOST_SSH_PORT: SSH port, usually 22.

Commit and push the logo changes, scripts, and workflow to main.
Open Actions > Bluehost upload > Run workflow. First leave preview_only checked.
Download bluehost-website and review manifest.txt. Run again with preview_only
unchecked to upload. Check the homepage, dashboard, and both logo URLs afterwards.

## Scope and limitations

The package uses Git-tracked public HTML, scripts, styles, JSON and media.
It excludes configuration, environment files, database migrations, documentation,
archives, backups and vendor source code (the browser Supabase bundle is included).
Review JSON and browser scripts for private data before publishing.
This deploys the static website only; it does not implement missing APIs or repair
broken links. SSH connection and a real upload require your Bluehost setup.
No automatic uploads on push are enabled.

References:
- https://www.bluehost.com/help/article/sftp
- https://www.bluehost.com/help/article/am-website-files-and-access-tab
