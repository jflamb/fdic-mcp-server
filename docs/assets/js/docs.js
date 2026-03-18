const SEARCH_SCRIPT_PATH = document.body?.dataset.pagefindScript ?? "/pagefind/pagefind.js";
const COPY_FEEDBACK_MS = 1800;
const SEARCH_DEBOUNCE_MS = 120;
const RESIZE_DEBOUNCE_MS = 100;
const MOBILE_BREAKPOINT = 760;

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const debounce = (fn, delay) => {
  let timer = 0;

  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
};

const enhanceCodeBlocks = () => {
  const codeBlocks = document.querySelectorAll(".doc-content pre");

  codeBlocks.forEach((block) => {
    if (block.closest(".code-block")) {
      return;
    }

    const code = block.querySelector("code");
    if (!code) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    block.parentNode.insertBefore(wrapper, block);
    wrapper.appendChild(block);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code block");
    wrapper.appendChild(button);

    button.addEventListener("click", async () => {
      const content = code.innerText;

      try {
        await navigator.clipboard.writeText(content);
        button.textContent = "Copied";
      } catch {
        button.textContent = "Press Ctrl/Cmd+C";
      }

      window.setTimeout(() => {
        button.textContent = "Copy";
      }, COPY_FEEDBACK_MS);
    });
  });
};

const enhanceTables = () => {
  const tables = document.querySelectorAll(".doc-content table");

  tables.forEach((table) => {
    if (table.parentElement?.classList.contains("table-wrap")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
};

const getHeadingText = (heading) => heading.textContent?.trim() ?? "";

const ensureHeadingIds = (headings) => {
  const seen = new Map();

  headings.forEach((heading) => {
    if (heading.id) {
      return;
    }

    const baseId = slugify(getHeadingText(heading)) || "section";
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    heading.id = count === 0 ? baseId : `${baseId}-${count + 1}`;
  });
};

const initPrimaryNavIndicator = () => {
  const navs = Array.from(document.querySelectorAll(".top-nav")).filter(
    (nav) => !nav.closest(".mobile-nav__panel"),
  );

  navs.forEach((nav) => {
    const links = Array.from(nav.querySelectorAll("a"));
    const activeLink = links.find((link) => link.classList.contains("is-active"));

    if (!activeLink) {
      return;
    }

    nav.classList.add("top-nav--animated");

    const indicator = document.createElement("span");
    indicator.className = "top-nav__indicator";
    indicator.setAttribute("aria-hidden", "true");
    nav.appendChild(indicator);

    let pinnedLink = activeLink;

    const moveIndicator = (link, immediate = false) => {
      if (!link) {
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();

      if (immediate) {
        indicator.style.transition = "none";
      }

      indicator.style.width = `${linkRect.width}px`;
      indicator.style.height = `${linkRect.height}px`;
      indicator.style.transform = `translate(${linkRect.left - navRect.left}px, ${linkRect.top - navRect.top}px)`;
      indicator.style.opacity = "1";

      if (immediate) {
        window.requestAnimationFrame(() => {
          indicator.style.transition = "";
        });
      }
    };

    moveIndicator(pinnedLink, true);

    links.forEach((link) => {
      link.addEventListener("pointerenter", () => moveIndicator(link));
      link.addEventListener("focus", () => moveIndicator(link));
      link.addEventListener("click", () => {
        pinnedLink = link;
        links.forEach((item) => {
          item.classList.toggle("is-active", item === link);
        });
        moveIndicator(link);
      });
    });

    nav.addEventListener("pointerleave", () => moveIndicator(pinnedLink));
    nav.addEventListener("focusout", (event) => {
      if (!nav.contains(event.relatedTarget)) {
        moveIndicator(pinnedLink);
      }
    });

    window.addEventListener("resize", debounce(() => moveIndicator(pinnedLink, true), RESIZE_DEBOUNCE_MS));
    window.addEventListener("load", () => moveIndicator(pinnedLink, true), { once: true });
  });
};

const renderToc = (target, headings) => {
  target.innerHTML = "";

  headings.forEach((heading) => {
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = getHeadingText(heading);
    link.dataset.level = heading.tagName === "H3" ? "3" : "2";
    target.appendChild(link);
  });
};

const activateToc = (targets, headings) => {
  const linkMap = new Map();

  targets.forEach((target) => {
    target.querySelectorAll("a").forEach((link) => {
      linkMap.set(link.getAttribute("href")?.slice(1), [
        ...(linkMap.get(link.getAttribute("href")?.slice(1)) ?? []),
        link,
      ]);
    });
  });

  const setActive = (id) => {
    linkMap.forEach((links, key) => {
      links.forEach((link) => {
        link.classList.toggle("is-active", key === id);
      });
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

      if (visible?.target?.id) {
        setActive(visible.target.id);
      }
    },
    {
      rootMargin: "-20% 0px -65% 0px",
      threshold: [0, 1],
    },
  );

  headings.forEach((heading) => observer.observe(heading));

  if (headings[0]?.id) {
    setActive(headings[0].id);
  }
};

const initPageToc = () => {
  const headings = Array.from(document.querySelectorAll(".doc-content h2, .doc-content h3")).filter(
    (heading) => getHeadingText(heading),
  );

  if (headings.length < 2) {
    return;
  }

  ensureHeadingIds(headings);

  const tocTargets = Array.from(document.querySelectorAll("[data-page-toc], [data-mobile-page-toc]"));
  if (tocTargets.length === 0) {
    return;
  }

  tocTargets.forEach((target) => renderToc(target, headings));

  document.querySelector("[data-page-toc-root]")?.removeAttribute("hidden");
  document.querySelector("[data-mobile-page-toc-root]")?.removeAttribute("hidden");

  activateToc(tocTargets, headings);
};

const initMobileNav = () => {
  const nav = document.querySelector("[data-mobile-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const closeButtons = document.querySelectorAll("[data-nav-close]");

  if (!nav || !toggle) {
    return;
  }

  const setOpen = (open) => {
    nav.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };

  toggle.addEventListener("click", () => {
    setOpen(nav.hidden);
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", () => setOpen(false));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  nav.addEventListener("click", (event) => {
    if (event.target === nav) {
      setOpen(false);
    }
  });

  window.addEventListener("resize", debounce(() => {
    if (window.innerWidth > MOBILE_BREAKPOINT) {
      setOpen(false);
    }
  }, RESIZE_DEBOUNCE_MS));
};

let pagefindModulePromise;

const loadPagefind = async () => {
  if (!pagefindModulePromise) {
    pagefindModulePromise = import(SEARCH_SCRIPT_PATH);
  }

  return pagefindModulePromise;
};

const getSectionLabel = (meta) => {
  const path = meta?.url || meta?.meta?.page_url;

  if (!path) {
    return "Docs";
  }

  if (path.startsWith("/technical")) {
    return "Technical";
  }
  if (path.startsWith("/user") || path.startsWith("/getting-started") || path.startsWith("/clients") || path.startsWith("/prompting") || path.startsWith("/usage-examples") || path.startsWith("/troubleshooting")) {
    return "User";
  }
  if (path.startsWith("/project") || path.startsWith("/release-notes") || path.startsWith("/support") || path.startsWith("/security") || path.startsWith("/contributing") || path.startsWith("/compatibility")) {
    return "Project";
  }
  return "Docs";
};

const initSearch = () => {
  const dialog = document.querySelector("[data-search-dialog]");
  const panel = dialog?.querySelector(".search-dialog__panel");
  const input = document.querySelector("[data-search-input]");
  const status = document.querySelector("[data-search-status]");
  const results = document.querySelector("[data-search-results]");
  const openButtons = document.querySelectorAll("[data-search-open]");
  const closeButtons = document.querySelectorAll("[data-search-close]");

  if (!dialog || !panel || !input || !status || !results) {
    return;
  }

  let currentQuery = "";
  let activeTrigger = null;

  const getFocusableElements = () =>
    Array.from(
      panel.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");

  const setSearchLoading = (isLoading) => {
    results.dataset.loading = isLoading ? "true" : "false";
    results.setAttribute("aria-busy", String(isLoading));
  };

  const close = () => {
    dialog.hidden = true;
    document.body.style.overflow = "";
    setSearchLoading(false);
    status.textContent = "Start typing to search the documentation.";
    results.innerHTML = "";
    activeTrigger?.focus();
  };

  const open = async (trigger = null) => {
    activeTrigger = trigger;
    const mobileNav = document.querySelector("[data-mobile-nav]");
    const navToggle = document.querySelector("[data-nav-toggle]");
    if (mobileNav && !mobileNav.hidden) {
      mobileNav.hidden = true;
      navToggle?.setAttribute("aria-expanded", "false");
    }

    dialog.hidden = false;
    document.body.style.overflow = "hidden";
    input.focus();

    if (!status.dataset.loaded) {
      status.textContent = "Loading search index...";

      try {
        await loadPagefind();
        status.textContent = "Start typing to search the documentation.";
        status.dataset.loaded = "true";
      } catch {
        status.textContent = "Search assets are not available in this build yet.";
      }
    }
  };

  const renderResults = async (query) => {
    currentQuery = query;
    results.innerHTML = "";

    if (!query.trim()) {
      setSearchLoading(false);
      status.textContent = "Start typing to search the documentation.";
      return;
    }

    try {
      status.textContent = "Searching...";
      setSearchLoading(true);
      const pagefind = await loadPagefind();
      const response = await pagefind.search(query);

      if (query !== currentQuery) {
        return;
      }

      if (!response.results.length) {
        setSearchLoading(false);
        status.textContent = `No results for "${query}".`;
        return;
      }

      status.textContent = `${response.results.length} result${response.results.length === 1 ? "" : "s"} for "${query}".`;

      const resultData = await Promise.all(response.results.slice(0, 8).map((result) => result.data()));

      if (query !== currentQuery) {
        return;
      }

      resultData.forEach((item) => {
        const link = document.createElement("a");
        link.className = "search-result";
        link.href = item.url;

        const meta = document.createElement("span");
        meta.className = "search-result__meta";
        meta.textContent = getSectionLabel(item);

        const title = document.createElement("h3");
        title.textContent = item.meta.title || item.url;

        const excerpt = document.createElement("p");
        excerpt.innerHTML = item.excerpt;

        link.append(meta, title, excerpt);
        results.appendChild(link);
      });

      setSearchLoading(false);
    } catch {
      setSearchLoading(false);
      status.textContent = "Search is unavailable in this build.";
    }
  };

  const debouncedSearch = debounce((event) => {
    renderResults(event.target.value);
  }, SEARCH_DEBOUNCE_MS);

  input.addEventListener("input", debouncedSearch);
  openButtons.forEach((button) =>
    button.addEventListener("click", () => {
      open(button);
    }),
  );
  closeButtons.forEach((button) => button.addEventListener("click", close));

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      close();
    }
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || dialog.hidden) {
      return;
    }

    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (!isTyping) {
        event.preventDefault();
        open(document.activeElement instanceof HTMLElement ? document.activeElement : null);
      }
    }

    if (event.key === "Escape" && !dialog.hidden) {
      close();
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  enhanceCodeBlocks();
  enhanceTables();
  initPrimaryNavIndicator();
  initPageToc();
  initMobileNav();
  initSearch();
});
