(() => {
  if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
    import("./assets/vendor/popover-polyfill.min.js").catch(() => {});
  }

  // Responsive site header: inline links on wide screens, popover drawer when collapsed
  const header = document.querySelector(".site-header");
  const inner = header?.querySelector(".header-inner");
  const menu = document.getElementById("site-menu");

  if (header && inner && menu) {
    let collapsedWidth = 0;
    const syncNav = () => {
      const currentWidth = header.clientWidth;
      if (!header.classList.contains("is-wide") && currentWidth <= collapsedWidth) return;

      const wasOpen = menu.matches(":popover-open") || menu.classList.contains(":popover-open");
      header.classList.add("is-measuring");
      menu.removeAttribute("popover");
      header.classList.add("is-wide");

      if (inner.scrollWidth <= inner.clientWidth + 1) {
        collapsedWidth = 0;
      } else {
        header.classList.remove("is-wide");
        menu.setAttribute("popover", "auto");
        collapsedWidth = currentWidth;
        if (wasOpen) {
          try {
            menu.showPopover?.();
          } catch {}
        }
      }

      requestAnimationFrame(() => header.classList.remove("is-measuring"));
    };

    const navObserver = new ResizeObserver(syncNav);
    navObserver.observe(header);
    navObserver.observe(menu);
    document.fonts?.ready.then(() => {
      collapsedWidth = 0;
      syncNav();
    });
    syncNav();

    menu.addEventListener("click", (event) => {
      if (event.target.closest("a") && !header.classList.contains("is-wide")) {
        try {
          menu.hidePopover?.();
        } catch {}
      }
    });
  }

  // Smooth <details> height interpolation via Web Animations API
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const running = new WeakMap();

  function clipOf(details) {
    let clip = details.querySelector(":scope > .dt-clip");
    if (clip) return clip;
    const content = [...details.children].filter((el) => el.tagName !== "SUMMARY");
    if (!content.length) return null;
    clip = document.createElement("div");
    clip.className = "dt-clip";
    content[0].before(clip);
    clip.append(...content);
    return clip;
  }

  function slide(details, opening) {
    const clip = clipOf(details);
    if (!clip) {
      details.open = opening;
      return;
    }
    const current = details.open ? clip.getBoundingClientRect().height : 0;
    running.get(details)?.cancel();
    if (opening) details.open = true;
    details.classList.toggle("is-closing", !opening);
    const full = clip.scrollHeight;
    const target = opening ? full : 0;
    const distance = Math.abs(target - current);
    const duration = Math.round(200 + 70 * Math.min(1, distance / 600));
    const share = (px) => (full ? Math.min(1, px / full) : 0);
    clip.style.overflow = "hidden";
    const animation = clip.animate(
      [
        { height: `${current}px`, opacity: share(current) },
        { height: `${target}px`, opacity: opening ? 1 : 0 },
      ],
      { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    );
    running.set(details, animation);
    animation.onfinish = () => {
      if (running.get(details) !== animation) return;
      running.delete(details);
      if (!opening) details.open = false;
      details.classList.remove("is-closing");
      animation.cancel();
      clip.style.overflow = "";
    };
  }

  for (const details of document.querySelectorAll("details")) clipOf(details);

  document.addEventListener("click", (event) => {
    if (reduce.matches || event.defaultPrevented) return;
    const summary = event.target.closest("summary");
    const details = summary?.parentElement;
    if (!details || details.tagName !== "DETAILS") return;
    event.preventDefault();
    const closing = details.open && !details.classList.contains("is-closing");
    slide(details, !closing);
  });

  // Home page scene motion + accessibility sync for domain accordions
  const domains = [...document.querySelectorAll("details.domain")];
  for (const domain of domains) {
    const body = domain.querySelector(".domain-body");
    if (!body) continue;
    const setAccess = (open) => {
      body.inert = !open;
      body.setAttribute("aria-hidden", String(!open));
    };
    domain.open = false;
    setAccess(false);
    domain.addEventListener("toggle", () => setAccess(domain.open));
  }

  addEventListener("pageshow", () => {
    for (const domain of domains) {
      domain.classList.remove("is-closing");
      domain.open = false;
    }
  });

  const scenes = document.querySelectorAll(".intro, .system-map, .education-section .section-heading");
  if (scenes.length) {
    let observer;
    const configureMotion = () => {
      observer?.disconnect();
      for (const scene of scenes) scene.classList.remove("is-playing", "motion-paused");
      if (reduce.matches) {
        for (const animation of document.getAnimations()) animation.cancel();
        return;
      }
      if (!("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) entry.target.classList.add("is-playing");
            entry.target.classList.toggle("motion-paused", !entry.isIntersecting);
            for (const animation of entry.target.getAnimations({ subtree: true })) {
              if (!entry.isIntersecting || document.hidden) animation.pause();
              else if (animation.playState === "paused") animation.play();
            }
          }
        },
        { threshold: 0.1 },
      );
      for (const scene of scenes) observer.observe(scene);
    };
    reduce.addEventListener("change", configureMotion);
    document.addEventListener("visibilitychange", () => {
      for (const scene of scenes) {
        for (const animation of scene.getAnimations({ subtree: true })) {
          if (document.hidden) animation.pause();
          else if (!scene.classList.contains("motion-paused") && animation.playState === "paused") animation.play();
        }
      }
    });
    configureMotion();
  }

  // Projects category filter with progressive View Transitions
  const filterBar = document.getElementById("filters");
  if (filterBar) {
    const areas = [
      ["all", "All"],
      ["software", "Software & web"],
      ["ai", "AI systems & automation"],
      ["networks", "Computer networks"],
      ["embedded", "Embedded & hardware"],
      ["industrial", "Industrial automation"],
      ["data", "Data & computing"],
    ];
    const items = [...document.querySelectorAll("[data-areas]")];
    const tiers = [...document.querySelectorAll("[data-tier]")];
    const empty = document.getElementById("empty");
    let statusEl = filterBar.querySelector(".filter-status");
    if (!statusEl) {
      statusEl = document.createElement("p");
      statusEl.className = "filter-status";
      filterBar.append(statusEl);
    }
    statusEl.setAttribute("role", "status");
    const chips = new Map();

    const render = (area, push) => {
      let shown = 0;
      for (const item of items) {
        const match = area === "all" || item.dataset.areas.split(" ").includes(area);
        item.hidden = !match;
        if (match) shown += 1;
      }
      for (const tier of tiers) tier.hidden = !tier.querySelector("[data-areas]:not([hidden])");
      for (const [key, chip] of chips) chip.setAttribute("aria-pressed", String(key === area));
      const label = areas.find(([key]) => key === area)?.[1] || "All";
      statusEl.textContent =
        area === "all"
          ? `Showing all ${items.length} projects`
          : `Showing ${shown} of ${items.length} projects in ${label}`;
      if (empty) empty.classList.toggle("show", shown === 0);
      if (push) {
        const url = new URL(location.href);
        if (area === "all") url.searchParams.delete("area");
        else url.searchParams.set("area", area);
        history.replaceState(null, "", url);
      }
    };

    const apply = (area) => {
      if (document.startViewTransition && !reduce.matches) {
        document.startViewTransition(() => render(area, true));
      } else {
        render(area, true);
      }
    };

    const existing = [...filterBar.querySelectorAll("[data-filter]")];
    if (existing.length) {
      for (const chip of existing) chips.set(chip.getAttribute("data-filter"), chip);
    } else {
      for (const [key, label] of areas) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = label;
        chip.setAttribute("data-filter", key);
        chip.setAttribute("aria-pressed", "false");
        chips.set(key, chip);
        filterBar.insertBefore(chip, statusEl);
      }
    }
    for (const [key, chip] of chips) chip.addEventListener("click", () => apply(key));

    const wanted = new URLSearchParams(location.search).get("area");
    render(areas.some(([key]) => key === wanted) ? wanted : "all", false);
  }

  // Native <dialog closedby="any"> Lightbox on hardware/screenshot figures
  const lightbox = document.getElementById("lightbox");
  if (lightbox instanceof HTMLDialogElement) {
    const lbImg = document.getElementById("lightbox-img");
    const lbTitle = document.getElementById("lightbox-title");
    const lbCaption = document.getElementById("lightbox-caption");
    const lbRaw = document.getElementById("lightbox-raw");
    const lbClose = document.getElementById("lightbox-close");

    lbClose?.addEventListener("click", () => lightbox.close());

    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("a.figure-trigger");
      if (!trigger) return;
      event.preventDefault();
      const figure = trigger.closest("figure");
      const thumb = trigger.querySelector("img");
      const caption = figure?.querySelector("figcaption")?.textContent?.trim() || "";
      const src = trigger.getAttribute("href");
      if (!src || !(lbImg instanceof HTMLImageElement)) return;
      lbImg.src = src;
      lbImg.alt = thumb?.getAttribute("alt") || caption;
      if (lbTitle) lbTitle.textContent = trigger.dataset.title || "Figure";
      if (lbCaption) lbCaption.textContent = caption;
      if (lbRaw instanceof HTMLAnchorElement) lbRaw.href = src;
      lightbox.showModal();
    });

    lightbox.addEventListener("close", () => {
      lightbox.returnValue = "";
    });

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const isOutside = (e) => {
        const r = lightbox.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      lightbox.addEventListener("pointerdown", (e) => {
        pressedOutside = isOutside(e);
      });
      lightbox.addEventListener("pointerup", (e) => {
        if (pressedOutside && isOutside(e)) lightbox.close();
      });
    }
  }

  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target instanceof HTMLDetailsElement) target.open = true;
  }
})();
