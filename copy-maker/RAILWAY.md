# Deploy Content OS to Railway

## 1. Create the service

1. In [Railway](https://railway.app), **New project** → **Deploy from GitHub** (or empty project + connect repo).
2. Add a service from this repository.
3. Open the service **Settings** → set **Root Directory** to `copy-maker` (if your repo root is the parent folder that contains `copy-maker/`).
4. Rename the service to **Content OS** (Settings → General → Service name).

## 2. Build-time environment variables (Vite)

`VITE_*` variables are inlined when `npm run build` runs. In Railway, add them under the service **Variables** tab and ensure they are available to the **build** step (Railway exposes the same variables to build and deploy by default).

Minimum for a working production UI with Gemini from the browser:

- `VITE_GEMINI_API_KEY` — Google AI Studio key (or use the aliases listed in `.env.example`).

Optional (same as local `.env`):

- `VITE_GEMINI_COPY_MODEL_PRIMARY`, `VITE_GEMINI_COPY_MODEL_FALLBACK`
- `VITE_NANO_BANANA_MODEL`
- `VITE_ANTHROPIC_API_KEY`, `VITE_OPENAI_API_KEY` if you use Opus / OpenAI copy from the header
- `VITE_ANTHROPIC_COPY_MODEL`, `VITE_OPENAI_COPY_MODEL`

If you omit Gemini keys, the app still builds; copy/image calls fall back to mocks or show errors when you try those actions.

## 3. What Railway runs

- **Build:** `npm run build` (Nixpacks auto-detects Node and runs `npm install` + `npm run build` when `package.json` has a `build` script).
- **Start:** `npm run start` → `vite preview` on `0.0.0.0:$PORT` so OS files and outlier catalog APIs keep working (they are not static files in `dist/`).

## 4. Repo layout on the server

The preview middleware reads from paths **relative to the `copy-maker` folder**:

- `../OS` — style guide, voices, personas  
- `../linkedin_influencers/data` — outlier index + framework cache  

So the GitHub repo pushed to Railway must include those folders (not only `copy-maker/`). Setting **Root Directory** to `copy-maker` still clones the full repo; parent paths resolve correctly.

## 5. Favicon / branding

- Tab title: **Content OS** (`index.html`).
- Favicon: `public/favicon.svg` (Vantum mark). Linked from `index.html` and `public/manifest.webmanifest`.
