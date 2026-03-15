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
- `Publish npm and Registry`: publishes tagged releases to npm, updates the official MCP Registry metadata, publishes GitHub Packages, and creates or updates the GitHub release
- `Publish GitHub Package`: backfills the GitHub release and GitHub Packages artifact from `main` when the primary publish workflow did not produce them

## Live Hosting Topology

The production HTTP endpoint is hosted on Google Cloud with this shape:

- GitHub Actions builds and deploys the container
- Artifact Registry stores the deployable image
- Cloud Run serves the HTTP transport
- `bankfind.jflamb.com` is mapped to the Cloud Run service as the public hostname

Operationally, this means the public MCP endpoint is a stateless Cloud Run revision that only needs the standard HTTP environment for startup:

- `TRANSPORT=http`
- `PORT=8080`

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

## One-Time Manual Steps

- Confirm billing is enabled on the target project
- Map your custom domain to the Cloud Run service after the first deploy
- Decide whether you want a single service hostname such as `bankfind.jflamb.com`

## Deployment Behavior

On every push to `main`, the workflow:

1. Authenticates to Google Cloud using GitHub OIDC
2. Builds the container image
3. Pushes the image to Artifact Registry
4. Deploys the new revision to Cloud Run

## Registry Publication

Release tags are configured to publish server metadata to the official MCP Registry using the documented `mcp-publisher` GitHub OIDC flow.

Relevant repo assets:

- `server.json` contains the MCP Registry metadata for this server
- `.github/workflows/publish.yml` runs `mcp-publisher login github-oidc` and `mcp-publisher publish` on tagged releases
- `scripts/sync-server-json.mjs` keeps `server.json` version fields aligned with `package.json`

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
