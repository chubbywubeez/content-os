# GitHub: `content-os` + Railway: **Content OS**

This folder is a git repo on branch `main`.

## Railway (Docker deploy from repo root)

Deploy from repo root:

```powershell
cd "c:\Users\brian\OneDrive\Desktop\Business\Vantum\Copy Maker"
railway link -p 4e5d1fe1-c074-4ce4-928e-0cf794f8b75e
railway up --detach
```

- Root `Dockerfile` now builds `apps/copy-maker`.
- It copies runtime data from `data/os`, `data/outliers/data`, `data/skills`, and `data/presentations`.
- Root `railway.toml` uses `builder = "DOCKERFILE"`.

## Optional: GitHub auto-deploy

```powershell
cd "c:\Users\brian\OneDrive\Desktop\Business\Vantum\Copy Maker"
gh auth login
gh repo create YOUR_GITHUB_USERNAME/content-os --public --source=. --remote=origin --push
```

Or if the repo already exists:

```powershell
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/content-os.git
git push -u origin main
```

In Railway, set service Root Directory to `.` so root Docker config is used.

## Repo layout snapshot

- `apps/copy-maker` — primary app.
- `data/os` — style guide, voices, personas.
- `data/outliers/data` — outlier catalog JSON files.
- `scripts/linkedin` — outlier processing scripts.
- `data/presentations` and `data/skills` — interview and prompt resources.
- `archive` — archived generated/local artifacts.
