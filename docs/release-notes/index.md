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
{% assign releases = site.data.releases %}
{% assign latest = site.data.latest_release %}

Releases are generated automatically by [semantic-release](https://github.com/semantic-release/semantic-release) from conventional commits. The current release is [{{ latest.tag_name }}]({{ latest.url }}).

{% for release in releases %}
## {{ release.display_name }}

<span class="release-date">{{ release.published_at | date: "%B %-d, %Y" }}</span>

{{ release.body | markdownify }}

[View on GitHub]({{ release.url }}){: .release-link }

{% endfor %}

{% if releases.size == 0 %}
Release data was unavailable during the last docs build. See the [GitHub Releases page](https://github.com/jflamb/fdic-mcp-server/releases) for the full history.
{% endif %}

[View all releases on GitHub](https://github.com/jflamb/fdic-mcp-server/releases){: .release-link }
