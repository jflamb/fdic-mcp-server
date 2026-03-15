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

This project can be deployed to Google Cloud Run with GitHub Actions using Workload Identity Federation rather than a long-lived Google service account key.

Current live endpoint:

- `https://bankfind.jflamb.com/mcp`

## What The Repo Provides

- A container image definition in `Dockerfile`
- A GitHub Actions deploy workflow in `.github/workflows/deploy-cloud-run.yml`
- Cloud Run HTTP mode via `TRANSPORT=http` and `PORT=8080`

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

Release tags also publish metadata to the official MCP Registry using the documented `mcp-publisher` GitHub OIDC flow. The registry metadata lives in `server.json` and is kept aligned with `package.json` during the release workflow.

## Endpoint Shape

The service exposes:

- `/health` for a health check
- `/mcp` for the streamable HTTP MCP endpoint
