# Cloud Run Deployment Setup

Reference: issue #33 and user request to investigate and implement Cloud Run deployment for the HTTP MCP server.

## Goals

- [x] Verify the active Google Cloud project and billing status.
- [x] Enable the Google Cloud services required for Cloud Run deployment.
- [x] Add containerization assets for this repository.
- [x] Add GitHub Actions deployment automation using Workload Identity Federation.
- [x] Document the one-time Google Cloud and DNS setup still required outside the repo.
- [ ] Validate with `npm run typecheck`, `npm test`, and `npm run build`.

## Acceptance Criteria

- [x] The project can be containerized and deployed to Cloud Run in HTTP mode.
- [x] The repo contains the deployment automation needed for GitHub Actions.
- [x] The deployment approach avoids long-lived Google service account keys.
- [x] The remaining manual GCP or DNS steps are explicit and minimal.
- [ ] Validation commands pass after the repo changes.

## Review / Results

- [x] Enabled `run.googleapis.com`, `artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`, `iamcredentials.googleapis.com`, and `secretmanager.googleapis.com`.
- [x] Created Artifact Registry repository `fdic-mcp` in `us-central1`.
- [x] Created deployer and runtime service accounts plus GitHub Workload Identity Federation binding for `jflamb/fdic-mcp-server`.
- [x] Configured GitHub repository variables for Cloud Run deployment.
- [x] Manually deployed `fdic-mcp-server` to Cloud Run and verified `https://fdic-mcp-server-72624156793.us-central1.run.app/health`.
