# GitHub: `content-os` under `chubbywueez`

This folder is a **git repo** (branch `main`) with an initial commit. GitHub CLI is **not** authenticated in the automated environment, so finish the remote on your machine.

## Option A — GitHub CLI (recommended)

```powershell
cd "c:\Users\brian\OneDrive\Desktop\Business\Vantum\Copy Maker"
gh auth login
gh repo create chubbywueez/content-os --public --source=. --remote=origin --push
```

If your GitHub username is different from `chubbywueez`, change the owner in the command.

## Option B — GitHub website

1. New repository → name **`content-os`** → create **empty** repo (no README).
2. Then:

```powershell
cd "c:\Users\brian\OneDrive\Desktop\Business\Vantum\Copy Maker"
git remote add origin https://github.com/chubbywueez/content-os.git
git push -u origin main
```

## What is in this repo

- **`copy-maker/`** — Content OS (Vite app; Railway **Root Directory** = `copy-maker`).
- **`OS/`** — Style guide, voices, personas (read at runtime by the Vite/Railway server).
- **`linkedin_influencers/data/outliers_index.json`** and **`outlier_framework_cache.json`** — outlier catalog for the UI.

`Problem Presentations/`, `Skills/`, and large outlier markdown dumps are **gitignored** on purpose.

## Railway + GitHub

A Railway project named **Content OS** was created and `copy-maker` was linked via `railway link` (workspace: chubbywubeez’s Projects).

After the repo exists on GitHub:

1. Open [Railway](https://railway.app) → project **Content OS**.
2. **New** → **GitHub Repo** → select **`chubbywueez/content-os`** (or connect the repo if prompted).
3. Service settings → **Root Directory** = **`copy-maker`**.
4. **Variables**: set `VITE_GEMINI_API_KEY` (and any other `VITE_*` keys) for **build** and runtime as needed.
5. Deploy; Railway runs `npm run build` then `npm run start` (see `copy-maker/railway.toml`).

If you prefer deploys without GitHub, from `copy-maker` you can use `railway up` — that only uploads the `copy-maker` folder and **will not** include `../OS` or outlier JSON; use **GitHub deploy** for production.
