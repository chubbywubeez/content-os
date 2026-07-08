# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Lead Magnet Maker pipeline

The app now includes a **Lead Magnet Maker** page and API pipeline.

- Pipeline run endpoint: `POST /api/lead-magnet-pipeline/run` (SSE stream)
- Artifacts endpoint: `GET /api/lead-magnet-pipeline/artifacts?slug=<slug>`
- Generated resources endpoint: `GET /api/lead-magnet-pipeline/resources`
- Artifact file endpoint: `GET /api/lead-magnet-pipeline/file?slug=<slug>&name=<file>`

Generated output is written to:

- `data/generated/lead-magnets/<slug>/guide.html`
- `data/generated/lead-magnets/<slug>/guide.pdf`
- `data/generated/lead-magnets/<slug>/audit-report.json`
- `data/generated/lead-magnets/<slug>/content.final.json`

### Local verification

1. Run `npm run dev`.
2. Open the **Lead Magnet** tab.
3. Paste a brief markdown payload and click **Run full pipeline**.
4. Confirm stage events progress from parse to final render.
5. Confirm generated artifacts appear in the Lead Magnet page and in the **Resources** page.

### Railway notes

- No extra service is required for this feature.
- Ensure the app has write access to `data/generated/lead-magnets`.
- Keep `OPENROUTER_API_KEY` set if you want LLM-assisted planning/writing. Without it, deterministic fallback content is used.
