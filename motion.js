(() => {
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
    const duration = Math.round(220 + 80 * Math.min(1, distance / 600));
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
})();
