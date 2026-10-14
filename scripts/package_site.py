"""Package tracked public website files; never include server configuration."""
from pathlib import Path
import subprocess
import tarfile

root = Path(__file__).resolve().parents[1]
allowed_roots = {"auth", "business", "core", "dashboard", "finance", "household",
                 "investment", "leisure", "modules", "onboarding", "shared"}
extensions = {".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".gif",
              ".svg", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".mp3", ".mp4", ".webm"}
tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
selected = []
for name in filter(None, tracked):
    path = Path(name)
    parts = {part.lower() for part in path.parts}
    if name != "index.html" and path.parts[0] not in allowed_roots:
        continue
    if parts & {"archive", "back up", "backup", "old-html", "old version", "node_modules"}:
        continue
    if name.startswith("shared/vendor/") and name != "shared/vendor/supabase.min.js":
        continue
    if path.suffix.lower() not in extensions or any(p.startswith(".") for p in path.parts):
        continue
    if (root / path).is_symlink():
        raise SystemExit(f"Refusing symlink: {name}")
    selected.append(name)
for required in ("index.html", "shared/assets/logo/geniesphere_logo.png",
                 "shared/assets/logo/geniesphere_logo_name.png"):
    if required not in selected:
        raise SystemExit(f"Required tracked file missing: {required}")
output = root / "dist"
output.mkdir(exist_ok=True)
with tarfile.open(output / "website.tar.gz", "w:gz") as bundle:
    for name in sorted(selected):
        bundle.add(root / name, arcname=name, recursive=False)
(output / "manifest.txt").write_text("\n".join(sorted(selected)) + "\n", encoding="utf-8")
print(f"Packaged {len(selected)} files in dist/website.tar.gz")
