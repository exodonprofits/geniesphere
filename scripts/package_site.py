"""Package tracked public website files; never include server configuration."""
from pathlib import Path
import json
import re
import subprocess
import tarfile

root = Path(__file__).resolve().parents[1]


def is_n8n_export(path):
    """n8n workflow exports expose webhook URLs and automation internals; no page loads them."""
    if path.suffix.lower() != ".json":
        return False
    try:
        data = json.loads((root / path).read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError):
        return False
    return isinstance(data, dict) and "nodes" in data and "connections" in data


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
    if is_n8n_export(path):
        continue
    if (root / path).is_symlink():
        raise SystemExit(f"Refusing symlink: {name}")
    selected.append(name)
for required in ("index.html", "shared/assets/logo/geniesphere_logo.png",
                 "shared/assets/logo/geniesphere_logo_name.png"):
    if required not in selected:
        raise SystemExit(f"Required tracked file missing: {required}")

# app-config.js repeats the public Supabase values for the synchronous canonical
# client; refuse to ship if it has drifted from /shared/config.json.
config = json.loads((root / "shared/config.json").read_text(encoding="utf-8"))
app_config = (root / "shared/js/app-config.js").read_text(encoding="utf-8")
for key in ("supabaseUrl", "supabaseAnonKey"):
    match = re.search(key + r':\s*window\.\w+\s*\|\|\s*"([^"]*)"', app_config)
    if not match or match.group(1) != config.get(key):
        raise SystemExit(f"shared/js/app-config.js {key} does not match shared/config.json")

output = root / "dist"
output.mkdir(exist_ok=True)
with tarfile.open(output / "website.tar.gz", "w:gz") as bundle:
    for name in sorted(selected):
        bundle.add(root / name, arcname=name, recursive=False)
(output / "manifest.txt").write_text("\n".join(sorted(selected)) + "\n", encoding="utf-8")
print(f"Packaged {len(selected)} files in dist/website.tar.gz")
