# Post-Deployment Verification Workflows

Automated Playwright testing workflows for deployment verification and continuous production monitoring.

## Workflows

### 1. Post-Deployment Smoke Tests (`post-deploy-smoke.yml`)

**Purpose:** Fast validation immediately after every production deployment

**Trigger:**
- `repository_dispatch` event type `deployment` from Vercel webhook
- Manual trigger via GitHub Actions UI

**Duration:** ~2 minutes

**Tests:** 5 smoke tests with mocked APIs
- ✅ Dashboard page loads
- ✅ Stat cards visible
- ✅ Last sync time displayed
- ✅ Sync buttons functional

**On Failure:**
- Deployment marked as failed
- Slack notification sent (if configured)
- Team alerted immediately

---

### 2. Scheduled Integration Tests (`scheduled-integration.yml`)

**Purpose:** Comprehensive production monitoring with real APIs and database

**Trigger:**
- Cron: Every 6 hours (`0 */6 * * *`)
- Manual trigger via GitHub Actions UI

**Duration:** ~12 minutes

**Tests:** 11 integration tests
- API connectivity (4 tests)
- Dashboard real data (3 tests)
- Stock sync and database (4 tests)

**On Failure:**
- GitHub issue auto-created with failure details
- Slack notification sent (if configured)
- Issue auto-closed when tests pass again

---

### 3. Health Check Tests (`health-check.spec.ts`)

**Purpose:** Deployment-specific critical path validation

**Tests:** 8 health checks
- Login flow performance (< 3s)
- Dashboard load time (< 2s)
- No JavaScript console errors
- No 4xx/5xx API errors
- ONEWMS widget rendering
- Page navigation
- Critical API endpoints
- SEO meta tags

**Tag:** `@post-deploy`

---

## Setup Instructions

### 1. Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions

**Required for Integration Tests:**
```
ONEWMS_PARTNER_KEY      Your ONEWMS partner API key
ONEWMS_DOMAIN_KEY       Your ONEWMS domain API key
DATABASE_URL            PostgreSQL connection string (Neon)
```

**Optional for Notifications:**
```
SLACK_WEBHOOK_URL       Slack incoming webhook URL
```

### 2. Enable Vercel Deployment Webhook (Optional)

To automatically trigger smoke tests after deployment:

1. Go to Vercel project settings
2. Navigate to "Git" → "Deploy Hooks"
3. Create a new hook:
   - **Name:** GitHub Actions Post-Deploy
   - **Branch:** main (production only)
   - **Hook URL:** `https://api.github.com/repos/{owner}/{repo}/dispatches`

**Alternative:** Workflows can be triggered manually via Actions tab

### 3. Configure Slack Notifications (Optional)

1. Create a Slack App in your workspace
2. Enable "Incoming Webhooks"
3. Create a webhook URL for your #deployments channel
4. Add webhook URL to GitHub Secrets as `SLACK_WEBHOOK_URL`

---

## Running Tests Locally

### Smoke Tests (Fast, Mocked)
```bash
npm run test:e2e:smoke
# ~30 seconds, no credentials needed
```

### Integration Tests (Slow, Real APIs)
```bash
# Requires ONEWMS credentials in environment
export ONEWMS_PARTNER_KEY=your_key
export ONEWMS_DOMAIN_KEY=your_key
export DATABASE_URL=your_db_url

npm run test:e2e:integration
# ~10 minutes, tests real API and database
```

### Post-Deploy Health Checks
```bash
npm run test:e2e:post-deploy
# ~2 minutes, performance and critical paths
```

### All Tests
```bash
npm run test:e2e
# Runs all tests (smoke + integration + health checks)
```

### Debug Mode
```bash
npm run test:e2e:debug
# Opens Playwright inspector for step-by-step debugging
```

---

## Manual Workflow Triggers

### Trigger Smoke Tests
```bash
gh workflow run post-deploy-smoke.yml
```

### Trigger Integration Tests
```bash
gh workflow run scheduled-integration.yml
```

---

## Test Results

### Viewing Reports

1. Go to GitHub Actions → Select workflow run
2. Scroll to "Artifacts" section
3. Download `playwright-*-report-{run_number}.zip`
4. Extract and open `index.html` in browser

**Retention:**
- HTML reports: 30 days
- Test results: 7 days

### Interpreting Results

**Smoke Tests:**
- ✅ **Pass:** Deployment successful, basic functionality works
- ❌ **Fail:** Critical issue with deployment, investigate immediately

**Integration Tests:**
- ✅ **Pass:** Production health confirmed, all systems operational
- ❌ **Fail:** May indicate:
  - ONEWMS API issues
  - Database connectivity problems
  - Expired credentials
  - Flaky test (check for pattern)

---

## Troubleshooting

### Tests Failing Locally But Passing in CI

**Cause:** Different base URLs or environment variables

**Solution:**
```bash
# Set BASE_URL to match production
export BASE_URL=https://live-commerce-opal.vercel.app
npm run test:e2e:smoke
```

### Integration Tests Skipped

**Cause:** Missing ONEWMS credentials

**Solution:** Tests gracefully skip if credentials not configured. Add secrets to GitHub or local environment.

### Workflow Not Triggering After Deployment

**Cause:** Vercel webhook not configured

**Solution:** Manually trigger workflow or set up Vercel deployment hook as described above.

### Slack Notifications Not Sending

**Cause:** Webhook URL not configured

**Solution:** Add `SLACK_WEBHOOK_URL` to GitHub Secrets. Leave blank to disable notifications.

---

## Cost Analysis

**GitHub Actions Free Tier:** 2,000 minutes/month

**Usage:**
- Smoke tests: ~2 min × 30 deploys/month = 60 min
- Integration tests: ~12 min × 4/day × 30 = 1,440 min
- **Total:** ~1,500 min/month (within free tier ✅)

**Storage:**
- Browser caching: ~350MB (one-time)
- Test reports: ~450MB/month (30-day retention)

---

## Future Enhancements

- [ ] Visual regression testing (Percy/Chromatic)
- [ ] Multi-browser testing (Firefox, Safari)
- [ ] Performance regression monitoring
- [ ] Automatic rollback on smoke test failure
- [ ] A/B test result validation
- [ ] Accessibility testing (WCAG)

---

## Support

For issues with these workflows:
1. Check workflow run logs in GitHub Actions
2. Review test failure screenshots/traces
3. Verify environment secrets are configured
4. Contact team in #deployments Slack channel
