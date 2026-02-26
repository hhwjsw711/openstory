# Rebrand External Services: Velro → OpenStory

## Context

The codebase has been rebranded from "Velro" to "OpenStory" (commit `e39cbff`). All code references are updated. What remains is renaming every external service, account, and hosting environment. The new domain is **openstory.so**.

---

## Step-by-step Order

The order matters — some services depend on others. DNS and domain come first because almost everything else references the domain.

### Step 1: Domain & DNS (openstory.so)

Set up DNS records before anything else. Other services need the domain to exist.

- [ ] Register/verify `openstory.so` with your DNS provider
- [ ] Set up these subdomains (can point to placeholder/parking for now):
  - `app.openstory.so` (or root) — production app
  - `local.openstory.so` — local dev (127.0.0.1 in /etc/hosts or DNS)
  - `notifications.openstory.so` — email sending domain (for Resend DKIM/SPF)
  - `assets.openstory.so` — R2 public assets (production)
  - `assets-stg.openstory.so` — R2 public assets (staging)
  - `storage.openstory.so` — R2 storage (production)
  - `storage-dev.openstory.so` — R2 storage (dev)

### Step 2: GitHub (org + repo rename)

Do this early — it affects all CI/CD and deployment integrations.

- [ ] Rename GitHub org `velro-ai` → new name (e.g., `openstory-so`)
  - GitHub auto-redirects old URLs, but update git remotes
- [ ] Rename repo `velro` → `openstory`
- [ ] Update local git remote:
  ```bash
  git remote set-url origin https://github.com/<new-org>/openstory.git
  ```
- [ ] Update any team members' local clones with new remote URL
- [ ] Verify GitHub Actions still trigger on the renamed repo

### Step 3: Vercel (rename project)

Depends on: Step 2 (repo rename) for the GitHub integration link.

- [ ] Go to Vercel dashboard → Project Settings → General
- [ ] Rename project from current name → `openstory`
- [ ] Update the GitHub repo connection to point to the renamed repo/org
- [ ] Update production domain: remove old domain, add `openstory.so` (or `app.openstory.so`)
- [ ] Update environment variables in Vercel dashboard:
  - `APP_URL` → `https://openstory.so` (or `https://app.openstory.so`)
  - `EMAIL_FROM` → `noreply@notifications.openstory.so`
  - `R2_PUBLIC_ASSETS_DOMAIN` → `assets.openstory.so`
  - `R2_PUBLIC_STORAGE_DOMAIN` → `storage.openstory.so`
  - Any other `velro.ai` references in env vars
- [ ] Verify preview deployments still work

### Step 4: Cloudflare (Pages + R2 + DNS)

Depends on: Step 1 (DNS), Step 2 (repo).

**Pages project:**

- [ ] Update Cloudflare Pages project to point to renamed GitHub repo
- [ ] Update custom domain to `openstory.so` (or subdomain)
- [ ] Update environment variables (same as Vercel list above)

**R2 buckets:**

> **Note:** A single R2 bucket can have multiple custom domains attached. During transition, add the new `openstory.so` domain alongside the old `velro.ai` domain on each bucket. This avoids data migration — just add the new domain, update your env vars, then remove the old domain later.

- [ ] Add `openstory.so` zone to Cloudflare (required — custom domains must be in the same account)
- [ ] For existing buckets (`velro-storage-dev`, `velro-public-assets-stg`, etc.):
  - Attach new custom domains alongside old ones (zero downtime):
    - `assets.openstory.so` → existing assets bucket
    - `assets-stg.openstory.so` → existing staging assets bucket
    - `storage.openstory.so` → existing storage bucket
    - `storage-dev.openstory.so` → existing dev storage bucket
  - Verify new domains resolve correctly
  - Update env vars to use new domains
  - Remove old `velro.ai` custom domains once confirmed
- [ ] Optionally rename buckets later (requires creating new bucket + migrating data — not urgent since bucket names aren't user-facing)

### Step 5: Turso (database rename)

Depends on: Nothing, but do after hosting so you can test connections.

- [ ] In Turso dashboard, create new databases with OpenStory naming:
  - `openstory-dev` (local dev)
  - `openstory-stg` (staging)
  - `openstory-prd` (production)
- [ ] Migrate data from `velro-dev-velro` → new database (or just use new empty DB for dev)
- [ ] Update connection strings:
  - `.env.local`: `TURSO_DATABASE_URL` → new `openstory-dev` URL
  - Vercel env vars: production/staging Turso URLs
  - Cloudflare env vars: production/staging Turso URLs
- [ ] Verify GitHub Actions workflow (`db-migrate.yml`) uses env vars (not hardcoded) — already confirmed

### Step 6: Resend (email domain)

Depends on: Step 1 (DNS records for DKIM/SPF).

- [ ] Add domain `openstory.so` (or `notifications.openstory.so`) in Resend dashboard
- [ ] Add the DKIM, SPF, and DMARC DNS records Resend provides
- [ ] Wait for domain verification (usually minutes)
- [ ] Update `EMAIL_FROM` in all environments to `noreply@notifications.openstory.so`
- [ ] Send a test email to verify delivery
- [ ] Remove old `velro.ai` domain from Resend (after confirming new domain works)

### Step 7: Google OAuth

Depends on: Step 3/4 (hosting domains finalized).

- [ ] Go to Google Cloud Console → APIs & Services → Credentials
- [ ] Update OAuth 2.0 Client:
  - App name: "OpenStory"
  - Authorized redirect URIs: replace `velro.ai` with `openstory.so`
  - Add both Vercel and Cloudflare domains if different
  - Keep old redirect URIs temporarily for transition
- [ ] Update OAuth consent screen branding (app name, logo, homepage URL)
- [ ] Test login flow on new domain
- [ ] Remove old `velro.ai` redirect URIs

### Step 8: Stripe

Depends on: Step 3/4 (hosting domains for webhook URLs).

- [ ] Update Stripe dashboard:
  - Account name / business name → "OpenStory"
  - Product names and descriptions (remove any "Velro" references)
- [ ] Update webhook endpoint URL to new domain
- [ ] Update checkout success/cancel redirect URLs
- [ ] Verify webhook signatures still work
- [ ] Test a checkout flow end-to-end

### Step 9: Upstash / QStash

Depends on: Step 3/4 (hosting domains for webhook delivery).

- [ ] Update QStash webhook URLs in production to point to new domain
- [ ] Verify QStash can reach the new domain
- [ ] Optionally rename the Upstash Redis instance in the dashboard (cosmetic)

### Step 10: Remaining Services (cosmetic / account-level)

These are API-key-based and don't reference the domain, but update for consistency.

- [ ] **LetzAI**: Regenerate API key if account email is `tom@velro.ai` — update to new email
- [ ] **Langfuse**: Update project name in dashboard to "OpenStory"
- [ ] **Fal.ai**: Update account/project name if applicable
- [ ] **OpenRouter**: Update account name if applicable
- [ ] **Cerebras**: Update account name if applicable
- [ ] **Doppler**: Rename project from "frontend" or "velro" → "openstory" if needed

### Step 11: Update `.env.local`

After all services are migrated, update local dev environment.

- [ ] `APP_URL=https://local.openstory.so`
- [ ] `EMAIL_FROM=noreply@notifications.openstory.so`
- [ ] `R2_BUCKET_NAME=openstory-storage-dev`
- [ ] `R2_PUBLIC_ASSETS_BUCKET=openstory-public-assets-stg`
- [ ] `R2_PUBLIC_ASSETS_DOMAIN=assets-stg.openstory.so`
- [ ] `R2_PUBLIC_STORAGE_DOMAIN=storage-dev.openstory.so`
- [ ] `TURSO_DATABASE_URL=libsql://openstory-dev-<org>.turso.io`
- [ ] Update `LETZAI_API_KEY` if regenerated
- [ ] Run `bun dev` and verify everything connects

### Step 12: Update `.env.example`

Commit updated example values so new devs get the right template.

- [ ] Update any remaining `velro` references in `.env.example` to `openstory.so`
- [ ] Commit the change

---

## Verification

After all steps:

- [ ] `bun dev` starts without errors
- [ ] Login via Google OAuth works on new domain
- [ ] Email sending works (trigger a test email)
- [ ] Image generation works (triggers R2 upload)
- [ ] Stripe checkout works
- [ ] QStash workflows process correctly
- [ ] GitHub Actions deploy successfully to both Vercel and Cloudflare
- [ ] Preview deployments work on PRs
- [ ] No remaining references to `velro` in any dashboard or config

---

## Files to Modify (code changes)

Only `.env.local` and `.env.example` need code-side updates — everything else is dashboard/console work. The codebase itself is already fully rebranded.

- `.env.local` — update all service URLs/domains (Step 11)
- `.env.example` — update example values (Step 12)
- Git remote URL — `git remote set-url origin` (Step 2)
