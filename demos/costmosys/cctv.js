(() => {
  const btn = document.getElementById('themeBtn');
  const saved = localStorage.getItem('scs_theme');
  const initial = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('scs_theme', theme);
    if (btn) {
      const light = theme === 'light';
      btn.innerHTML = light
        ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>'
        : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
      btn.setAttribute('aria-label', light ? 'Gunakan tema gelap' : 'Gunakan tema terang');
    }
  }
  apply(initial);
  btn?.addEventListener('click', () => apply(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
})();
