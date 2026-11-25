(() => {
  const sheet = document.getElementById("site-sheet");
  const toggles = document.querySelectorAll("[data-sheet-toggle]");

  if (sheet && toggles.length) {
    const opener = document.querySelector(".menu-toggle");
    const setOpen = (open) => {
      sheet.classList.toggle("is-open", open);
      sheet.inert = !open;
      document.body.classList.toggle("has-sheet", open);
      opener?.setAttribute("aria-expanded", String(open));
      if (open) sheet.querySelector("a, button")?.focus({ preventScroll: true });
      else opener?.focus({ preventScroll: true });
    };
    sheet.inert = true;
    for (const toggle of toggles) {
      toggle.addEventListener("click", () => setOpen(!sheet.classList.contains("is-open")));
    }
    sheet.addEventListener("click", (event) => {
      if (event.target.closest("nav a")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sheet.classList.contains("is-open")) setOpen(false);
    });
    matchMedia("(min-width: 1021px)").addEventListener("change", (event) => {
      if (event.matches && sheet.classList.contains("is-open")) setOpen(false);
    });
  }

  const revealables = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    for (const element of revealables) element.classList.add("is-revealed");
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  );
  for (const element of revealables) observer.observe(element);
})();
