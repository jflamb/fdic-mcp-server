---
title: Cloud Run Deployment
nav_group: technical
kicker: Technical Docs
summary: Container, GitHub Actions, and Google Cloud configuration for deploying the HTTP MCP server to Cloud Run.
breadcrumbs:
  - title: Overview
    url: /
  - title: Technical Docs
    url: /technical/
---

This project serves its public HTTP MCP endpoint from Google Cloud Run and deploys that service from GitHub Actions using Workload Identity Federation rather than a long-lived Google service account key.

Current live endpoint:

- `https://bankfind.jflamb.com/mcp`

## What The Repo Provides

- A container image definition in `Dockerfile`
- A GitHub Actions deploy workflow in `.github/workflows/deploy-cloud-run.yml`
- Cloud Run HTTP mode via `TRANSPORT=http` and `PORT=8080`

## Workflow Roles

The repository uses a small set of GitHub Actions workflows with distinct responsibilities:

- `CI`: runs typechecking, tests, build validation, and package-content checks on pushes to `main` and pull requests
- `Deploy Docs`: builds and publishes the GitHub Pages documentation site from `docs/`
- `Deploy Cloud Run`: builds the production container image and deploys the public HTTP MCP endpoint to Google Cloud Run
- `Release`: runs after successful `CI` on the latest `main` commit, computes the next semantic version from conventional commits, publishes npm, creates the GitHub release and tag, updates the official MCP Registry metadata, and publishes GitHub Packages

## Live Hosting Topology

The production HTTP endpoint is hosted on Google Cloud with this shape:

- GitHub Actions builds and deploys the container
- Artifact Registry stores the deployable image
- Cloud Run serves the HTTP transport
- `bankfind.jflamb.com` is mapped to the Cloud Run service as the public hostname

Operationally, this means the public MCP endpoint is a stateless Cloud Run revision that only needs the standard HTTP environment for startup:

- `TRANSPORT=http`
- `PORT=8080`
- a non-root container user for the production runtime

## Expected Google Cloud Resources

This repo is configured around the following resource pattern:

- Project: `fdic-mcp-prod`
- Region: `us-central1`
- Artifact Registry repository: `fdic-mcp`
- Cloud Run service: `fdic-mcp-server`
- GitHub deployer service account: `github-cloud-run-deployer@fdic-mcp-prod.iam.gserviceaccount.com`
- Runtime service account: `fdic-mcp-runtime@fdic-mcp-prod.iam.gserviceaccount.com`
- Workload Identity provider:
  `projects/72624156793/locations/global/workloadIdentityPools/github-actions/providers/github-actions-provider`

## GitHub Actions Variables

Set these repository variables before relying on the deploy workflow:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GAR_REPOSITORY`
- `GAR_IMAGE`
- `CLOUD_RUN_SERVICE`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`

These are stored as GitHub repository variables because they are identifiers and deployment settings, not secrets. They tell the workflow which Google Cloud project, region, service, and identity objects to use.

## GitHub Repository And Environment Configuration

The deployment flow depends on a small amount of GitHub-side configuration:

- Repository variables provide the Google Cloud project, region, Artifact Registry, Cloud Run service, and Workload Identity identifiers
- The `production` environment is used for the Cloud Run deployment record shown in GitHub Deployments
- The `production` environment URL is set by the workflow to `https://bankfind.jflamb.com/mcp`
- The `github-pages` environment is used separately by the docs deployment workflow

No long-lived Google Cloud credential needs to be stored in the repository or in GitHub environment secrets for the Cloud Run deploy path.

## Authentication Model

Google Cloud deployment uses GitHub OIDC plus Workload Identity Federation:

1. GitHub Actions issues an OIDC identity token for the workflow run
2. Google Workload Identity Federation trusts that token for the configured provider
3. The workflow impersonates the configured Google service account
4. Google returns short-lived credentials for Artifact Registry and Cloud Run operations

This is why the workflow only needs repository variables such as `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT`. It does not require a checked-in service-account JSON key or a long-lived GitHub secret containing Google credentials.

## One-Time Manual Steps

- Confirm billing is enabled on the target project
- Map your custom domain to the Cloud Run service after the first deploy
- Decide whether you want a single service hostname such as `bankfind.jflamb.com`

## Deployment Behavior

The production deploy workflow runs in two cases:

1. automatically after the `CI` workflow completes successfully for `main`
2. manually through `workflow_dispatch` when an operator explicitly triggers it

On an automatic production deploy, the workflow:

1. checks out the exact commit SHA that passed CI
2. authenticates to Google Cloud using GitHub OIDC
3. builds the container image
4. pushes the image to Artifact Registry
5. deploys the new revision to Cloud Run

Production deploy concurrency is serialized. Newer deploy requests wait rather than canceling an in-flight production rollout.

## Container Runtime Expectations

The production image is built as a multi-stage Docker image and the final runtime stage switches to a dedicated non-root user before startup.

That gives Cloud Run the same HTTP contract as before:

- `TRANSPORT=http`
- `PORT=8080`

It also avoids running the application process as `root` in production, which is the expected baseline for this service unless a future deployment target imposes a different requirement.

## Registry Publication

Automated releases publish server metadata to the official MCP Registry using the documented `mcp-publisher` GitHub OIDC flow.

Relevant repo assets:

- `server.json` contains the MCP Registry metadata for this server
- `.github/workflows/publish.yml` runs after successful `CI` on `main`, uses `semantic-release` to calculate the next version, and then runs `mcp-publisher login github-oidc` and `mcp-publisher publish`
- `scripts/sync-server-json.mjs` keeps `server.json` version fields aligned with the semantic-release version written into `package.json`

Registry references:

- Official MCP Registry API: `https://registry.modelcontextprotocol.io/`
- Official MCP Registry repository and docs: `https://github.com/modelcontextprotocol/registry`

Current status note:

- The repository is configured to publish to the official MCP Registry
- As of March 15, 2026, a public FDIC BankFind entry was not discoverable in the registry API during verification
- Because of that, this documentation treats registry publication as configured automation rather than a confirmed public listing
- GitHub Packages publication is also automated, but that is a package registry, not an MCP registry

## Endpoint Shape

The service exposes:

- `/health` for a health check
- `/mcp` for the streamable HTTP MCP endpoint
