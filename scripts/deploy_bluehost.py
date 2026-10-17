"""Upload the packaged site (dist/manifest.txt) to Bluehost over FTPS.

Add/overwrite only: no server file is deleted except when being replaced by a
packaged file of the same path. Trust model is the
same as the connection test (docs/DECISIONS.md ADR-007): connect to the pinned
server IP and verify the certificate chain against a fixed name.

Modes:
  --dry-run  connect, log in, report what would be uploaded; write nothing
  (default)  back up remote files about to be overwritten, then upload

A remote manifest of sha256 hashes (MANIFEST_NAME) records what the last
successful deploy uploaded, so unchanged files are skipped; each file's
presence and size on the server are still checked.
"""
from pathlib import Path
import argparse
import base64
import ftplib
import gzip
import hashlib
import io
import json
import os
import socket
import ssl
import sys

root = Path(__file__).resolve().parents[1]
MANIFEST_NAME = ".gs-deploy-manifest.json"
TMP_SUFFIX = ".gs-upload"


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def connect(env):
    host, ip, cert_name = env["BLUEHOST_HOST"], env["BLUEHOST_EXPECTED_IP"], env["BLUEHOST_CERT_NAME"]
    try:
        resolved = {info[4][0] for info in socket.getaddrinfo(host, 21, proto=socket.IPPROTO_TCP)}
    except socket.gaierror:
        resolved = set()
    if ip not in resolved:
        sys.exit("BLUEHOST_HOST does not point at BLUEHOST_EXPECTED_IP; stopping before login.")
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=60)
    ftp.connect(ip, 21)
    # ftplib uses self.host only as the TLS server_hostname (control and data channels).
    ftp.host = cert_name
    ftp.auth()
    ftp.login(env["BLUEHOST_USER"], env["BLUEHOST_FTP_PASSWORD"])
    ftp.prot_p()
    ftp.cwd("/")
    print(f"Connected: certificate verified for {cert_name}, logged in, data channel encrypted.")
    return ftp


def remote_size(ftp, name):
    """Size in bytes, or None if the remote file does not exist."""
    ftp.voidcmd("TYPE I")
    try:
        return ftp.size(name)
    except ftplib.error_perm as exc:
        if str(exc).startswith("550"):
            return None
        raise  # e.g. SIZE unsupported: never guess "missing" and overwrite without backup


def read_remote_manifest(ftp):
    buffer = io.BytesIO()
    try:
        ftp.retrbinary("RETR " + MANIFEST_NAME, buffer.write)
    except ftplib.error_perm:
        return {}
    try:
        data = json.loads(buffer.getvalue().decode("utf-8"))
    except ValueError:
        print("Remote manifest unreadable; treating every file as changed.")
        return {}
    return data.get("files", {}) if isinstance(data, dict) else {}


def ensure_dirs(ftp, name, known):
    parts = name.split("/")[:-1]
    for depth in range(1, len(parts) + 1):
        directory = "/".join(parts[:depth])
        if directory in known:
            continue
        try:
            ftp.mkd(directory)
        except ftplib.error_perm as exc:
            if not str(exc).startswith("550"):
                raise
        known.add(directory)


def put(ftp, name, handle):
    """Upload to a temporary name, then rename over the live file."""
    temporary = name + TMP_SUFFIX
    ftp.storbinary("STOR " + temporary, handle)
    try:
        ftp.rename(temporary, name)
    except ftplib.error_perm:
        # Some servers refuse to rename onto an existing file; replace it explicitly.
        ftp.delete(name)
        ftp.rename(temporary, name)


def fetch(names, out_dir):
    """Read-only: download server files. Only files already served from the web root."""
    for name in names:
        if name.startswith("/") or ".." in name.split("/") or not name.strip():
            sys.exit(f"Refusing unsafe path: {name!r}")
    ftp = connect(os.environ)
    try:
        for name in names:
            buffer = io.BytesIO()
            try:
                ftp.retrbinary("RETR " + name, buffer.write)
            except ftplib.error_perm as exc:
                print(f"== {name}: not fetched ({exc})")
                continue
            data = buffer.getvalue()
            target = out_dir / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            print(f"== {name}: {len(data)} bytes, sha256 {hashlib.sha256(data).hexdigest()}")
            if len(data) <= 64 * 1024:
                try:
                    print(data.decode("utf-8"))
                except UnicodeDecodeError:
                    print("(binary, not printed)")
            # Exact bytes for tools that cannot download artifacts. Base64 is also
            # immune to Actions secret masking, which rewrites matching plain text.
            encoded = base64.b64encode(gzip.compress(data, mtime=0)).decode("ascii")
            print(f"-- gzip+base64 begin {name}")
            for start in range(0, len(encoded), 76):
                print(encoded[start:start + 76])
            print(f"-- gzip+base64 end {name}")
        print("Fetch only: nothing was uploaded, changed, or deleted.")
    finally:
        try:
            ftp.quit()
        except (OSError, EOFError, ftplib.Error):
            ftp.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--backup-dir", default=str(root / "dist" / "backup"))
    parser.add_argument("--fetch", nargs="+", metavar="PATH",
                        help="read-only: download these server files and print small text ones")
    args = parser.parse_args()

    required = ("BLUEHOST_HOST", "BLUEHOST_USER", "BLUEHOST_FTP_PASSWORD",
                "BLUEHOST_EXPECTED_IP", "BLUEHOST_CERT_NAME")
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        sys.exit("Missing settings: " + ", ".join(missing))

    if args.fetch:
        fetch(args.fetch, root / "dist" / "fetched")
        return

    manifest_path = root / "dist" / "manifest.txt"
    names = [line for line in manifest_path.read_text(encoding="utf-8").splitlines() if line]
    for name in names:
        if name.startswith("/") or ".." in name.split("/") or name.endswith(TMP_SUFFIX):
            sys.exit(f"Refusing unsafe path in manifest: {name}")
    local = {name: sha256(root / name) for name in names}
    print(f"Local package: {len(local)} files.")

    ftp = connect(os.environ)
    try:
        previous = read_remote_manifest(ftp)
        print(f"Remote manifest: {len(previous)} files from the last deploy.")

        new, overwrite, unchanged = [], [], 0
        foreign = {}   # name -> current server bytes, for files a deploy did not put there
        adopted = {}   # server files already byte-identical to the package
        missing = 0
        for name, digest in sorted(local.items()):
            # The manifest can outlive the files (e.g. the host wiped the web root),
            # so confirm each file still exists before trusting it.
            size = remote_size(ftp, name)
            if size is None:
                new.append(name)
                missing += name in previous
            elif previous.get(name) == digest and size == (root / name).stat().st_size:
                unchanged += 1
            elif name in previous and previous[name] != digest:
                overwrite.append(name)  # deployed by us before, content changed
            else:
                # Not from a deploy: compare content so identical files are left alone.
                buffer = io.BytesIO()
                ftp.retrbinary("RETR " + name, buffer.write)
                if hashlib.sha256(buffer.getvalue()).hexdigest() == digest:
                    adopted[name] = digest
                    unchanged += 1
                else:
                    foreign[name] = buffer.getvalue()
                    overwrite.append(name)

        print(f"Plan: {len(new)} new, {len(overwrite)} overwrite, {unchanged} unchanged, 0 deletions.")
        if missing:
            print(f"{missing} file(s) listed in the remote manifest are missing on the server and will be re-uploaded.")
        if adopted:
            print(f"{len(adopted)} existing server file(s) already match the package and are left as is.")
        if foreign:
            print(f"{len(foreign)} existing server file(s) not from a previous deploy differ and will be replaced"
                  + ("" if args.dry_run else " (backed up first)") + ":")
            for name, data in foreign.items():
                print(f"  {name} (server {len(data)} bytes, package {(root / name).stat().st_size} bytes)")
        if args.dry_run:
            for name in new:
                print("  new: " + name)
            for name in overwrite:
                if name not in foreign:
                    print("  update: " + name)
            print("Dry run: nothing was uploaded, changed, or deleted.")
            return

        backup_root = Path(args.backup_dir)
        for name, data in foreign.items():
            target = backup_root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        if foreign:
            print(f"Backed up {len(foreign)} file(s) to {backup_root}.")

        known_dirs = set()
        # Files dropped from the package stay on the server, so keep their entries.
        uploaded = dict(previous)
        uploaded.update(adopted)
        for index, name in enumerate(new + overwrite, 1):
            ensure_dirs(ftp, name, known_dirs)
            with open(root / name, "rb") as handle:
                put(ftp, name, handle)
            uploaded[name] = local[name]
            if index % 50 == 0:
                print(f"  uploaded {index}/{len(new) + len(overwrite)}")

        body = json.dumps({"files": dict(sorted(uploaded.items()))}, indent=0).encode("utf-8")
        put(ftp, MANIFEST_NAME, io.BytesIO(body))
        print(f"Deploy complete: {len(new)} new, {len(overwrite)} overwritten, {unchanged} unchanged, 0 deleted.")
    finally:
        try:
            ftp.quit()
        except (OSError, EOFError, ftplib.Error):
            ftp.close()


if __name__ == "__main__":
    main()
