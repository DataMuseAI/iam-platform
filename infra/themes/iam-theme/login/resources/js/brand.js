/*
 * Portal-aware branding for the LeadFlow login pages.
 *
 * The same Keycloak client serves two portals:
 *   - /admin          -> "LeadFlow Admin"   (platform operators, manage all tenants)
 *   - /<tenantSlug>   -> "LeadFlow AddOn"   (tenant workspace, slug shown as badge)
 *
 * The portal is detected from the OIDC redirect_uri, which is present either
 * directly in the query string (initial /auth request) or inside the base64
 * `client_data` parameter used by subsequent login-actions URLs.
 */
(function () {
  'use strict';

  function decodeClientData(value) {
    try {
      var b64 = value.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var data = JSON.parse(atob(b64));
      return data && data.ru ? data.ru : null;
    } catch (e) {
      return null;
    }
  }

  function findRedirectUri() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('redirect_uri')) return params.get('redirect_uri');
    if (params.get('client_data')) {
      var ru = decodeClientData(params.get('client_data'));
      if (ru) return ru;
    }
    // Fall back to any form action / link carrying client_data (e.g. after a failed login POST)
    var nodes = document.querySelectorAll('form[action*="client_data="], a[href*="client_data="]');
    for (var i = 0; i < nodes.length; i++) {
      var raw = nodes[i].getAttribute('action') || nodes[i].getAttribute('href');
      try {
        var cd = new URL(raw, window.location.origin).searchParams.get('client_data');
        var found = cd && decodeClientData(cd);
        if (found) return found;
      } catch (e) { /* ignore */ }
    }
    try {
      var stored = sessionStorage.getItem('lf-portal-ru');
      if (stored) return stored;
    } catch (e) { /* ignore */ }
    return null;
  }

  function detectPortal() {
    var ru = findRedirectUri();
    if (ru) {
      try { sessionStorage.setItem('lf-portal-ru', ru); } catch (e) { /* ignore */ }
    }
    var path = '/';
    try { path = new URL(ru || '/', window.location.origin).pathname; } catch (e) { /* ignore */ }
    var first = path.split('/').filter(Boolean)[0] || '';
    if (first.toLowerCase() === 'admin') {
      return { kind: 'admin', badge: 'Admin', subtitle: 'Platform administration — manage all tenants.' };
    }
    return {
      kind: 'tenant',
      badge: first || 'AddOn',
      subtitle: 'Sign in to your ' + (first || 'AddOn') + ' workspace.'
    };
  }

  function apply() {
    var portal = detectPortal();
    var body = document.body;
    body.classList.add('lf-portal-' + portal.kind);
    body.setAttribute('data-lf-subtitle', portal.subtitle);

    var brand = document.getElementById('kc-header-wrapper');
    if (brand) {
      brand.textContent = '';
      var name = document.createElement('span');
      name.className = 'lf-brand-name';
      name.textContent = 'LeadFlow';
      var badge = document.createElement('span');
      badge.className = 'lf-brand-badge';
      badge.textContent = portal.badge;
      brand.appendChild(name);
      brand.appendChild(badge);
      brand.setAttribute('aria-label', 'LeadFlow ' + portal.badge);
    }

    var sub = document.createElement('p');
    sub.className = 'lf-subtitle';
    sub.textContent = portal.subtitle;
    var title = document.getElementById('kc-page-title');
    if (title && document.body.getAttribute('data-page-id') === 'login-login') {
      title.insertAdjacentElement('afterend', sub);
    }

    document.title = document.title.replace(/saas-dev|LeadFlow/i, 'LeadFlow ' + portal.badge);
    body.classList.add('lf-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
