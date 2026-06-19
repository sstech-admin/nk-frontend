# Deploy nk-frontend (React/Vite) — AWS Amplify Hosting

## About the "env file"
There is **no committed `.env`** (it's gitignored) — that's normal. Vite only
reads variables prefixed `VITE_`, and it **bakes them in at build time**. So for
Amplify you don't ship a file; you set the variable in the Amplify Console and it
is applied during the build.

- Local dev → `.env` with `VITE_API_URL=` blank (Vite proxies `/api` to localhost:4000).
- Production → set `VITE_API_URL` in Amplify (see step 4).

## 1. Push this folder to its own Git repo
`nk-frontend` is already a git repo. Push it to GitHub (or AWS CodeCommit).

## 2. Create the Amplify app
1. AWS Console → **Amplify** → **Create new app** → **Host web app**.
2. Connect your Git provider → pick the `nk-frontend` repo + branch.
3. Build settings: Amplify auto-detects `amplify.yml` (build `npm run build`,
   artifacts in `dist`). Accept it.

## 3. Set the backend URL (critical)
Amplify Console → your app → **Hosting → Environment variables** → add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | your App Runner backend URL, **no trailing slash**, e.g. `https://abcd.us-east-1.awsapprunner.com` |

Then **redeploy** (Amplify → Redeploy this version) so the build picks it up.
If you change `VITE_API_URL` later, you must redeploy — it is compiled in.

## 4. (Optional) SPA rewrite
This app is a single page (no client-side routing), so no rewrite is required.
If you ever add routing, add an Amplify rewrite: source `</^[^.]+$/>` →
target `/index.html` → type `200 (Rewrite)`.

## 5. Verify
- Open the Amplify URL (e.g. `https://main.xxxx.amplifyapp.com`) → you should see the login.
- Log in as **admin / <ADMIN_PASSWORD you set on the backend>**.
- If login fails with a network/CORS error: confirm `VITE_API_URL` is correct AND
  the backend's `CORS_ORIGIN` includes this Amplify URL (then redeploy the backend).
