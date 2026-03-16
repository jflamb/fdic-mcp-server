---
title: Release Notes
nav_group: project
kicker: Project Info
summary: Versioned release history for the server, including feature additions and notable behavior changes.
breadcrumbs:
  - title: Overview
    url: /
  - title: Project Info
    url: /project-information/
---
{% assign latest_release = site.data.latest_release %}

Current releases are generated automatically by `semantic-release` and recorded on the GitHub Releases page.

Latest published release: [{{ latest_release.tag_name }}]({{ latest_release.url }}){% if latest_release.published_at %}, published {{ latest_release.published_at | date: "%B %-d, %Y" }}{% endif %}.

Historical manually curated notes remain here for earlier releases:

- [Version 1.1.3]({{ '/release-notes/v1.1.3/' | relative_url }})
- [Version 1.1.2]({{ '/release-notes/v1.1.2/' | relative_url }})
- [Version 1.1.1]({{ '/release-notes/v1.1.1/' | relative_url }})
- [Version 1.1.0]({{ '/release-notes/v1.1.0/' | relative_url }})
