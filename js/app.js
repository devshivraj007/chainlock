/**
 * app.js — SIH26150 DVR/NVR Forensic Recovery Tool
 * Shared utilities: i18n, accessibility controls, toast, API, routing
 */

'use strict';

/* ============================================================
   CONSTANTS
   ============================================================ */
const APP_VERSION = '0.9.0-prototype';
const API_BASE = 'http://localhost:8000'; // FastAPI backend

/* ============================================================
   I18N
   ============================================================ */
const I18N = { en: null, hi: null };

async function loadStrings(lang) {
  if (I18N[lang]) return I18N[lang];
  try {
    const resp = await fetch(`js/${lang}.json`);
    I18N[lang] = await resp.json();
  } catch {
    I18N[lang] = I18N.en || {};
  }
  return I18N[lang];
}

function t(key, replacements = {}) {
  const lang = getCurrentLang();
  const strings = I18N[lang] || I18N.en || {};
  const parts = key.split('.');
  let val = strings;
  for (const p of parts) val = val?.[p];
  if (val === undefined) {
    // fallback to English
    let fallback = I18N.en;
    for (const p of parts) fallback = fallback?.[p];
    val = fallback ?? key;
  }
  if (typeof val !== 'string') return key;
  return val.replace(/\{(\w+)\}/g, (_, k) => replacements[k] ?? `{${k}}`);
}

/* ============================================================
   LANGUAGE / ACCESSIBILITY PREFS  (persist in localStorage)
   ============================================================ */
function getCurrentLang() { return localStorage.getItem('lang') || 'en'; }

async function setLang(lang) {
  localStorage.setItem('lang', lang);
  await loadStrings(lang);
  document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (el.tagName === 'INPUT' && el.placeholder !== undefined) el.placeholder = text;
    else el.textContent = text;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  // Update lang buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  updateHindiElements(lang);
}

function updateHindiElements(lang) {
  document.querySelectorAll('[data-hindi-only]').forEach(el => {
    el.style.display = lang === 'hi' ? '' : 'none';
  });
}

function getTextSize() { return localStorage.getItem('textSize') || 'md'; }
function setTextSize(size) {
  localStorage.setItem('textSize', size);
  document.documentElement.dataset.textSize = size;
}

function getContrast() { return localStorage.getItem('highContrast') === '1'; }
function setContrast(on) {
  localStorage.setItem('highContrast', on ? '1' : '0');
  document.documentElement.classList.toggle('high-contrast', on);
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function toast(message, type = 'info', duration = 5000) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const id = `toast-${Date.now()}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.id = id;
  div.setAttribute('role', 'alert');
  div.setAttribute('aria-live', 'polite');
  div.innerHTML = `
    <span aria-hidden="true">${icons[type] || 'ℹ️'}</span>
    <span style="flex:1">${message}</span>
    <button class="toast-close" aria-label="Dismiss notification" onclick="this.closest('.toast').remove()">✕</button>
  `;
  region.appendChild(div);
  if (duration > 0) setTimeout(() => div?.remove(), duration);
}

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */
function confirmDialog(message, onConfirm, onCancel) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'confirm-title');
  backdrop.innerHTML = `
    <div class="modal-box">
      <h2 id="confirm-title" style="font-size:var(--text-lg);margin-bottom:var(--space-4)">Confirm Action</h2>
      <p style="margin-bottom:var(--space-6);color:var(--color-text-muted)">${message}</p>
      <div style="display:flex;gap:var(--space-4);justify-content:flex-end">
        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-ok">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const firstBtn = backdrop.querySelector('#confirm-cancel');
  firstBtn.focus();
  // Trap focus
  backdrop.addEventListener('keydown', e => {
    if (e.key === 'Escape') { backdrop.remove(); onCancel?.(); }
    if (e.key === 'Tab') {
      const focusable = backdrop.querySelectorAll('button');
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === focusable[0]) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); focusable[0].focus(); }
    }
  });
  backdrop.querySelector('#confirm-ok').onclick = () => { backdrop.remove(); onConfirm?.(); };
  backdrop.querySelector('#confirm-cancel').onclick = () => { backdrop.remove(); onCancel?.(); };
}

/* ============================================================
   COPY TO CLIPBOARD
   ============================================================ */
async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = orig; }, 2000);
    toast('Copied to clipboard', 'success', 2000);
  } catch {
    toast('Copy failed — please copy manually', 'error');
  }
}

/* ============================================================
   SKELETON LOADER HELPERS
   ============================================================ */
function skeletonLine(width = '100%', height = '1em') {
  return `<span class="skeleton" style="width:${width};height:${height};display:block;margin-bottom:8px"></span>`;
}

/* ============================================================
   API CLIENT
   ============================================================ */
const api = {
  async get(path) {
    const resp = await fetch(`${API_BASE}${path}`);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  },
  async post(path, body) {
    const resp = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    return resp.json();
  }
};

/* ============================================================
   FORMAT HELPERS
   ============================================================ */
function fmtBytes(bytes, lang = 'en') {
  const units = ['B','KB','MB','GB','TB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
function fmtDate(iso, lang = 'en') {
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
  }).format(new Date(iso));
}
function fmtNum(n, lang = 'en') {
  return new Intl.NumberFormat(lang === 'hi' ? 'hi-IN' : 'en-IN').format(n);
}

/* ============================================================
   SHARED COMPONENTS — Header / Footer injection
   ============================================================ */
function buildTopbar() {
  return `
  <div class="topbar no-print">
    <div class="container">
      <div class="topbar-inner">
        <div class="topbar-helpline">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 01.25 2.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          <span data-i18n="topbar.helpline">${t('topbar.helpline')}</span>
        </div>
        <div class="topbar-controls">
          <div class="lang-switch" role="group" aria-label="Language selection">
            <button class="lang-btn ${getCurrentLang()==='en'?'active':''}" data-lang="en" onclick="setLang('en')" aria-pressed="${getCurrentLang()==='en'}">English</button>
            <button class="lang-btn ${getCurrentLang()==='hi'?'active':''}" data-lang="hi" onclick="setLang('hi')" aria-pressed="${getCurrentLang()==='hi'}" lang="hi">हिन्दी</button>
          </div>
          <div class="text-size-controls" role="group" aria-label="${t('topbar.textSize')}">
            <span style="font-size:10px;color:rgba(255,255,255,0.7);margin-right:4px">${t('topbar.textSize')}</span>
            <button class="text-size-btn" title="Small text" aria-label="Decrease text size" onclick="setTextSize('sm')">A−</button>
            <button class="text-size-btn" title="Normal text" aria-label="Normal text size" onclick="setTextSize('md')">A</button>
            <button class="text-size-btn" title="Large text" aria-label="Increase text size" onclick="setTextSize('lg')">A+</button>
          </div>
          <button class="contrast-btn" title="${t('topbar.contrast')}" aria-label="Toggle high contrast" aria-pressed="${getContrast()}"
            onclick="const on=!getContrast();setContrast(on);this.setAttribute('aria-pressed',on)">
            ◑ ${t('topbar.contrast')}
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

function buildHeader(activePage = 'home') {
  const navItems = [
    { key: 'home', href: 'index.html', icon: '🏠' },
    { key: 'newCase', href: 'new-case.html', icon: '➕' },
    { key: 'cases', href: 'cases.html', icon: '📁' },
    { key: 'verify', href: 'verify.html', icon: '✅' },
    { key: 'reports', href: 'reports.html', icon: '📄' },
    { key: 'help', href: 'help.html', icon: '❓' }
  ];
  const navHtml = navItems.map(n => `
    <li>
      <a href="${n.href}" class="nav-link ${activePage === n.key ? 'active' : ''}" 
         ${activePage === n.key ? 'aria-current="page"' : ''}>
        <span aria-hidden="true">${n.icon}</span>
        <span data-i18n="nav.${n.key}">${t('nav.'+n.key)}</span>
      </a>
    </li>
  `).join('');
  return `
  <header class="site-header no-print" role="banner">
    <div class="container">
      <div class="header-inner">
        <a href="index.html" class="logo-area" aria-label="${t('appName')} - Home">
          <div class="logo-placeholder" aria-hidden="true">FD</div>
          <div class="logo-text-block">
            <span class="logo-title" data-i18n="appShort">${t('appShort')}</span>
            <span class="logo-subtitle">SIH 2026 · Prototype</span>
          </div>
        </a>
        <button class="hamburger" id="hamburger-btn" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="main-nav">
          <span></span><span></span><span></span>
        </button>
        <nav id="main-nav" class="site-nav" aria-label="Main navigation">
          <ul class="nav-list" role="list">${navHtml}</ul>
        </nav>
        <div class="header-search" role="search">
          <label for="global-search" class="visually-hidden">Search cases</label>
          <input type="search" id="global-search" placeholder="Search cases…" aria-label="Search cases" autocomplete="off">
          <button aria-label="Submit search" onclick="handleGlobalSearch()">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
        </div>
      </div>
    </div>
  </header>`;
}

function buildFooter() {
  return `
  <footer class="site-footer no-print" role="contentinfo">
    <div class="container">
      <div class="footer-top">
        <div class="footer-col">
          <h4>ForensicDVR</h4>
          <ul>
            <li><a href="index.html" data-i18n="nav.home">${t('nav.home')}</a></li>
            <li><a href="new-case.html" data-i18n="nav.newCase">${t('nav.newCase')}</a></li>
            <li><a href="cases.html" data-i18n="nav.cases">${t('nav.cases')}</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="help.html" data-i18n="nav.help">${t('nav.help')}</a></li>
            <li><a href="help.html#limitations">Limitations</a></li>
            <li><a href="help.html#accessibility" data-i18n="footer.accessibility">${t('footer.accessibility')}</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Legal</h4>
          <ul>
            <li><a href="#" data-i18n="footer.privacy">${t('footer.privacy')}</a></li>
            <li><a href="#" data-i18n="footer.terms">${t('footer.terms')}</a></li>
            <li><a href="#" data-i18n="footer.contact">${t('footer.contact')}</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Support</h4>
          <p style="color:rgba(255,255,255,0.7);font-size:11px" data-i18n="footer.hours">${t('footer.hours')}</p>
          <p style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:8px">Helpline: 1800-XXX-XXXX</p>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="footer-disclaimer" data-i18n="footer.disclaimer">${t('footer.disclaimer')}</p>
        <span class="footer-version">${t('footer.version')} ${APP_VERSION}</span>
      </div>
    </div>
  </footer>`;
}

function buildDatasetBar(label = 'SYNTHETIC') {
  const cls = { SYNTHETIC: 'badge-synthetic', 'PUBLIC-EXPORT': 'badge-public', 'REAL-DISK': 'badge-real' };
  return `
  <div class="dataset-label-bar no-print" role="alert" aria-label="Dataset classification: ${label}">
    <div class="container">
      <span aria-hidden="true">🏷️</span>
      <strong>Dataset:</strong>
      <span class="badge ${cls[label] || 'badge-synthetic'}">${label}</span>
      <span class="text-muted" style="font-size:11px">— All evidence in this session is classified as <em>${label}</em></span>
    </div>
  </div>`;
}

function buildBreadcrumb(items) {
  const html = items.map((item, i) => {
    const isLast = i === items.length - 1;
    return `<li><a href="${item.href}" ${isLast ? 'aria-current="page"' : ''}>${item.label}</a></li>`;
  }).join('');
  return `<nav aria-label="Breadcrumb"><ol class="breadcrumb">${html}</ol></nav>`;
}

/* ============================================================
   HAMBURGER MENU
   ============================================================ */
function initHamburger() {
  const btn = document.getElementById('hamburger-btn');
  const nav = document.getElementById('main-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', isOpen);
  });
}

/* ============================================================
   GLOBAL SEARCH
   ============================================================ */
function handleGlobalSearch() {
  const q = document.getElementById('global-search')?.value?.trim();
  if (q) window.location.href = `cases.html?q=${encodeURIComponent(q)}`;
}

document.getElementById('global-search')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleGlobalSearch();
});

/* ============================================================
   INIT
   ============================================================ */
async function initApp(activePage) {
  // Load preferences
  const lang = getCurrentLang();
  const size = getTextSize();
  const contrast = getContrast();
  if (size !== 'md') document.documentElement.dataset.textSize = size;
  if (contrast) document.documentElement.classList.add('high-contrast');

  // Load strings
  await loadStrings('en');
  await loadStrings('hi');
  await loadStrings(lang);

  // Set HTML lang
  document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';

  // Inject topbar
  const topbarEl = document.getElementById('topbar-slot');
  if (topbarEl) topbarEl.innerHTML = buildTopbar();

  // Inject header
  const headerEl = document.getElementById('header-slot');
  if (headerEl) headerEl.innerHTML = buildHeader(activePage);

  // Inject footer
  const footerEl = document.getElementById('footer-slot');
  if (footerEl) footerEl.innerHTML = buildFooter();

  initHamburger();
  initKeyboardSearch();
}

function initKeyboardSearch() {
  const inp = document.getElementById('global-search');
  if (inp) {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleGlobalSearch(); });
  }
}

// Expose globally
window.t = t;
window.toast = toast;
window.confirmDialog = confirmDialog;
window.copyToClipboard = copyToClipboard;
window.fmtBytes = fmtBytes;
window.fmtDate = fmtDate;
window.fmtNum = fmtNum;
window.api = api;
window.APP_VERSION = APP_VERSION;
window.getCurrentLang = getCurrentLang;
window.setLang = setLang;
window.getContrast = getContrast;
window.setContrast = setContrast;
window.getTextSize = getTextSize;
window.setTextSize = setTextSize;
window.skeletonLine = skeletonLine;
window.buildDatasetBar = buildDatasetBar;
window.buildBreadcrumb = buildBreadcrumb;
window.initApp = initApp;
