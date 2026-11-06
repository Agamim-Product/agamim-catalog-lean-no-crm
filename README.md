# Agamim data catalog (static site)

The site is plain static files (`index.html` plus a compiled app bundle in `assets/`). There is no build step.
Live at https://agamim-product.github.io/agamim-catalog-lean-no-crm/

## Run locally

```
npm ci
npm run serve        # http://127.0.0.1:4173
```

## Tests (Playwright)

```
npm ci
npx playwright install chromium
npm test
```

To reuse an installed browser instead of downloading one: `PW_CHANNEL=msedge npm test` (or `chrome`).

The suite covers the login and first-visit profile, the home greeting, the "add dataset" side panel end to end,
and consistency checks on the JSON data.

## CI/CD (`.github/workflows/ci.yml`)

| Event | Tests | Deploy |
| --- | --- | --- |
| push to any branch / pull request | yes | no |
| push to `main` | yes | yes, after tests pass |
| "Run workflow" (any branch) | yes | yes, after tests pass |

Deploying publishes the site files (without tests or tooling) to the `gh-pages` branch, which GitHub Pages serves.

## Adding a dataset

Product managers register a dataset with **"+ הוספת מאגר"** in the app. To publish it for everyone, export the package
and run (PowerShell, Windows PowerShell 5.1):

```
powershell -ExecutionPolicy Bypass -File tools\apply-package.ps1 -Package <path to dataset-N.package.json>
```

Then review with `git diff`, commit and push to `main`.
