# GitHub: `content-os` + Railway: **Content OS**

This folder is a **git** repo on branch `main`.

## Railway (already wired — deploy without GitHub)

The monorepo root is linked to Railway project **Content OS**. Deploy from **this folder** (parent of `copy-maker/`), not from inside `copy-maker/` alone:

```powershell
cd "c:\Users\brian\OneDrive\Desktop\Business\Vantum\Copy Maker"
railway link -p 4e5d1fe1-c074-4ce4-928e-0cf794f8b75e
railway up --detach
```

- **`Dockerfile`** at repo root builds `copy-maker` plus **`OS/`** and the two outlier JSON files (same layout the Vite preview middleware expects).
- **`railway.toml`** at repo root sets `builder = "DOCKERFILE"`.

In the Railway dashboard, open the latest deployment **Build logs** if something fails. Set **Variables** (e.g. `VITE_GEMINI_API_KEY`) on the service — add them for **build** so Vite can inline them.

### Optional: GitHub for auto-deploy from pushes

The Cursor / agent shell does **not** have `gh` logged in; you still run this **once** on your PC:

```powershell
cd "c:\Users\brian\OneDrive\Desktop\Business\Vantum\Copy Maker"
gh auth login
gh repo create YOUR_GITHUB_USERNAME/content-os --public --source=. --remote=origin --push
```

Or create an empty repo on GitHub and:

```powershell
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/content-os.git
git push -u origin main
```

Then in Railway: connect that repo and set **Root Directory** to **`.`** (repo root) so the **root** `Dockerfile` and `railway.toml` are used — **not** `copy-maker` alone.

## What is in this repo (for Docker / Git)

- **`copy-maker/`** — Content OS (Vite app).
- **`OS/`** — Style guide, voices, personas, image generation system.
- **`.cursor/skills/`** — Cursor Agent Skills (e.g. `vantum-image-generation`).
- **`linkedin_influencers/data/outliers_index.json`** and **`outlier_framework_cache.json`** — outlier catalog.

`Problem Presentations/`, `Skills/`, and large outlier markdown dumps are **gitignored**.

## Legacy note

`copy-maker/railway.toml` targets Nixpacks + `npm start` from the **copy-maker** subfolder only. For **Docker** deploys from **monorepo root**, the root **`railway.toml`** + **`Dockerfile`** take precedence when you `railway up` from the repo root.
