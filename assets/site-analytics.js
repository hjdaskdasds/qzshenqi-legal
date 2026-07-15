(function () {
  const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];
  const STORAGE_KEY = 'oi_attribution_v1';

  function readStoredAttribution() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        window.localStorage.removeItem(STORAGE_KEY);
        return {};
      }
      return parsed.values || {};
    } catch (error) {
      return {};
    }
  }

  function persistAttribution(values) {
    const clean = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value != null && String(value).trim() !== '')
    );
    if (!Object.keys(clean).length) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        values: clean,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 45
      }));
    } catch (error) {
      // Storage can fail in private browsing. Attribution still works for this page view.
    }
  }

  function currentAttribution() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = {};
    ATTRIBUTION_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) fromUrl[key] = value;
    });
    if (!fromUrl.utm_source && document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.hostname !== window.location.hostname) fromUrl.ref = referrer.hostname;
      } catch (error) {
        fromUrl.ref = document.referrer;
      }
    }
    if (Object.keys(fromUrl).length) persistAttribution({ ...readStoredAttribution(), ...fromUrl });
    return { ...readStoredAttribution(), ...fromUrl };
  }

  function decorateTallyLinks() {
    const attribution = currentAttribution();
    document.querySelectorAll('a[href^="https://tally.so/"]').forEach((link) => {
      try {
        const url = new URL(link.href);
        Object.entries(attribution).forEach(([key, value]) => url.searchParams.set(key, value));
        url.searchParams.set('landing_page', window.location.pathname);
        if (window.oiSelectedPlan) url.searchParams.set('plan', window.oiSelectedPlan);
        link.href = url.toString();
      } catch (error) {
        // Ignore malformed links and leave the original href intact.
      }
    });
  }

  window.oiTrack = function oiTrack(eventName, parameters) {
    const payload = {
      page_path: window.location.pathname,
      page_title: document.title,
      ...currentAttribution(),
      ...(parameters || {})
    };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...payload });
    if (typeof window.gtag === 'function') window.gtag('event', eventName, payload);
    if (typeof window.plausible === 'function') window.plausible(eventName, { props: payload });
    if (window.umami && typeof window.umami.track === 'function') window.umami.track(eventName, payload);
  };

  document.addEventListener('DOMContentLoaded', () => {
    decorateTallyLinks();
    window.oiTrack('page_view');
  });

  window.oiDecorateTallyLinks = decorateTallyLinks;
})();
