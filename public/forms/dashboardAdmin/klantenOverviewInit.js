// public/forms/dashboardAdmin/klantenOverviewInit.js
/**
 * Admin Dashboard - Klanten Overview
 *
 * Haalt alle klanten 1x op via /routes/dashboard/admin/klanten en doet alle
 * filter/sort/pagination in-memory in de browser.
 *
 * Filters:
 *  - Zoek (naam + adres + email)
 *  - Plaats (multi-select via checkboxes)
 *  - Heeft abonnement (ja/nee)
 *  - Abonnement status (meerdere tegelijk, OR binnen groep)
 *  - Heeft eenmalig (ja/nee)
 *  - Eenmalig status (meerdere tegelijk, OR binnen groep)
 *  - Aangemaakt-op datum range (van/tot)
 *
 * Sort:
 *  - aangemaakt-desc (default), aangemaakt-asc, naam-asc, naam-desc, plaats-asc, plaats-desc
 *
 * Pagination: prev / next (page_size standaard 20)
 *
 * Volgt het bestaande dashboard patroon: states via data-loading-state /
 * data-content-state / data-dashboard-error, en lijst via
 * data-klanten-state="heeft-items" / "geen-items" met een template klant-item.
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

const LOG = '[Admin Klanten Overview]';
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

// Mapping van Webflow filter-waardes → database status waardes.
// Zo kun je in Webflow label-vriendelijke waardes gebruiken terwijl de filter
// intern wel met de echte DB statussen werkt.
const ABO_STATUS_MAP = {
  actief: 'actief',
  gepauzeerd: 'gepauzeerd',
  opgezegd: 'gestopt',          // Webflow 'opgezegd' → DB 'gestopt'
  gestopt: 'gestopt',
  'in-afwachting': 'wachtrij',  // Webflow 'in-afwachting' → DB 'wachtrij'
  wachtrij: 'wachtrij',
};

const EENMALIG_STATUS_MAP = {
  nieuw: 'aangevraagd',         // Webflow 'nieuw' → DB 'aangevraagd'
  aangevraagd: 'aangevraagd',
  gepland: 'gepland',
  afgerond: 'voltooid',         // Webflow 'afgerond' → DB 'voltooid'
  voltooid: 'voltooid',
  geannuleerd: 'geannuleerd',
};

// =============================================================================
// STATE
// =============================================================================
const state = {
  allKlanten: [],      // Volledige lijst zoals opgehaald van API
  filtered: [],        // Na filter + sort
  plaatsOptions: [],   // Unieke plaatsen uit allKlanten
  filters: {
    search: '',
    plaatsen: new Set(),         // Set<string>
    heeftAbo: false,
    aboStatus: new Set(),        // Set<string>: 'actief','gepauzeerd','gestopt','wachtrij'
    heeftEenmalig: false,
    eenmaligStatus: new Set(),   // Set<string>: 'aangevraagd','gepland','voltooid','geannuleerd'
    datumVan: '',
    datumTot: '',
  },
  // Gecachte template nodes (detached uit DOM na init, clone per render)
  templates: {
    klantItem: null,            // HTMLElement (detached)
    klantItemParent: null,      // HTMLElement waar klant clones in geappend worden
    plaatsOption: null,         // HTMLElement (detached)
    plaatsOptionParent: null,   // HTMLElement waar plaats option clones in geappend worden
  },
  sort: 'aangemaakt-desc',
  page: 1,
};

// =============================================================================
// FORMATTERS
// =============================================================================
function formatDatum(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

function formatAboStatus(status) {
  const map = {
    wachtrij: 'In afwachting',
    actief: 'Actief',
    gepauzeerd: 'Gepauzeerd',
    gestopt: 'Opgezegd',
  };
  return map[status] || status || '-';
}

function formatOpdrachtStatus(status) {
  const map = {
    aangevraagd: 'Aangevraagd',
    gepland: 'Gepland',
    voltooid: 'Voltooid',
    geannuleerd: 'Geannuleerd',
  };
  return map[status] || status || '-';
}

function formatFrequentie(frequentie) {
  const map = {
    perweek: '1x per week',
    pertweeweek: '1x per 2 weken',
    vierweeks: '1x per 4 weken',
    eenmalig: 'Eenmalig',
  };
  return map[frequentie] || frequentie || '-';
}

function formatEenmaligType(type) {
  const map = {
    dieptereiniging: 'Dieptereiniging',
    verhuis: 'Verhuisschoonmaak',
    tapijt: 'Tapijtreiniging',
    bankreiniging: 'Bankreiniging',
    vloer: 'Vloerreiniging',
  };
  return map[type] || type || '-';
}

function addStatusClass(el, status, kind) {
  if (!el) return;
  const aboMap = {
    actief: 'is-active',
    wachtrij: 'is-pending',
    gepauzeerd: 'is-pending',
    gestopt: 'is-unactive',
  };
  const opdrMap = {
    aangevraagd: 'is-pending',
    gepland: 'is-pending',
    voltooid: 'is-active',
    geannuleerd: 'is-unactive',
  };
  const cls = (kind === 'abo' ? aboMap[status] : opdrMap[status]) || 'is-pending';
  el.classList.remove('is-active', 'is-pending', 'is-unactive');
  el.classList.add(cls);
}

// =============================================================================
// FILTERING + SORT + PAGINATION
// =============================================================================
function matchesSearch(klant, needle) {
  if (!needle) return true;
  const q = needle.trim().toLowerCase();
  if (!q) return true;

  const naam = `${klant.voornaam || ''} ${klant.achternaam || ''}`.toLowerCase();
  const email = (klant.email || '').toLowerCase();
  const adres = klant.adres
    ? [
        klant.adres.straat,
        klant.adres.huisnummer,
        klant.adres.toevoeging,
        klant.adres.postcode,
        klant.adres.plaats,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
    : '';

  return naam.includes(q) || email.includes(q) || adres.includes(q);
}

function matchesPlaats(klant, plaatsenSet) {
  if (plaatsenSet.size === 0) return true;
  const plaats = klant.adres?.plaats || '';
  return plaatsenSet.has(plaats);
}

function matchesHeeftAbo(klant, required) {
  if (!required) return true;
  return (klant.abonnementen || []).length > 0;
}

function matchesAboStatus(klant, statusSet) {
  if (statusSet.size === 0) return true;
  return (klant.abonnementen || []).some((a) => statusSet.has(a.status));
}

function matchesHeeftEenmalig(klant, required) {
  if (!required) return true;
  return (klant.opdrachten || []).length > 0;
}

function matchesEenmaligStatus(klant, statusSet) {
  if (statusSet.size === 0) return true;
  return (klant.opdrachten || []).some((o) => statusSet.has(o.status));
}

function matchesDatumRange(klant, van, tot) {
  if (!van && !tot) return true;
  if (!klant.aangemaakt_op) return false;
  const d = new Date(klant.aangemaakt_op);
  if (isNaN(d.getTime())) return false;
  if (van) {
    const vanD = new Date(van);
    if (d < vanD) return false;
  }
  if (tot) {
    const totD = new Date(tot);
    // Inclusief hele dag: tot 23:59:59
    totD.setHours(23, 59, 59, 999);
    if (d > totD) return false;
  }
  return true;
}

function applyFilters(list) {
  const f = state.filters;
  return list.filter(
    (k) =>
      matchesSearch(k, f.search) &&
      matchesPlaats(k, f.plaatsen) &&
      matchesHeeftAbo(k, f.heeftAbo) &&
      matchesAboStatus(k, f.aboStatus) &&
      matchesHeeftEenmalig(k, f.heeftEenmalig) &&
      matchesEenmaligStatus(k, f.eenmaligStatus) &&
      matchesDatumRange(k, f.datumVan, f.datumTot)
  );
}

function applySort(list) {
  const copy = [...list];
  switch (state.sort) {
    case 'aangemaakt-asc':
      copy.sort(
        (a, b) =>
          new Date(a.aangemaakt_op || 0) - new Date(b.aangemaakt_op || 0)
      );
      break;
    case 'naam-asc':
      copy.sort((a, b) => naamKey(a).localeCompare(naamKey(b), 'nl'));
      break;
    case 'naam-desc':
      copy.sort((a, b) => naamKey(b).localeCompare(naamKey(a), 'nl'));
      break;
    case 'plaats-asc':
      copy.sort((a, b) =>
        (a.adres?.plaats || '').localeCompare(b.adres?.plaats || '', 'nl')
      );
      break;
    case 'plaats-desc':
      copy.sort((a, b) =>
        (b.adres?.plaats || '').localeCompare(a.adres?.plaats || '', 'nl')
      );
      break;
    case 'aangemaakt-desc':
    default:
      copy.sort(
        (a, b) =>
          new Date(b.aangemaakt_op || 0) - new Date(a.aangemaakt_op || 0)
      );
      break;
  }
  return copy;
}

function naamKey(klant) {
  return `${klant.voornaam || ''} ${klant.achternaam || ''}`.trim().toLowerCase();
}

// =============================================================================
// RENDERING
// =============================================================================
function showLoading() {
  const loading = document.querySelector('[data-loading-state]');
  const content = document.querySelector('[data-content-state]');
  const errorC = document.querySelector('[data-dashboard-error]');
  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';
  if (errorC) errorC.style.display = 'none';
}

function showContent() {
  const loading = document.querySelector('[data-loading-state]');
  const content = document.querySelector('[data-content-state]');
  const errorC = document.querySelector('[data-dashboard-error]');
  if (loading) loading.style.display = 'none';
  if (content) content.style.display = 'block';
  if (errorC) errorC.style.display = 'none';
}

function showError(message) {
  const loading = document.querySelector('[data-loading-state]');
  const content = document.querySelector('[data-content-state]');
  const errorC = document.querySelector('[data-dashboard-error]');
  if (loading) loading.style.display = 'none';
  if (content) content.style.display = 'none';
  if (errorC) {
    const msgEl = errorC.querySelector('[data-error-message]');
    if (msgEl) msgEl.textContent = message || 'Er ging iets mis.';
    else errorC.textContent = message || 'Er ging iets mis.';
    errorC.style.display = 'block';
  }
}

function renderCounts(filteredCount) {
  const shown = document.querySelector('[data-klanten-count-shown]');
  const total = document.querySelector('[data-klanten-count-total]');
  if (shown) shown.textContent = String(filteredCount);
  if (total) total.textContent = String(state.allKlanten.length);
}

function renderSortActive() {
  const buttons = document.querySelectorAll('[data-klanten-sort]');
  buttons.forEach((btn) => {
    if (btn.getAttribute('data-klanten-sort') === state.sort) {
      btn.classList.add('is-active');
    } else {
      btn.classList.remove('is-active');
    }
  });
}

// =============================================================================
// TEMPLATE CACHING
// =============================================================================
// We cachen templates éénmalig bij init. We halen de originele template-nodes
// uit de DOM zodat elke render gewoon vers kan clonen vanuit de cache. Dit is
// robuust t.o.v. combo-class namen op de Webflow kant.

function cacheTemplates() {
  // Outer klant template
  const klantEl = document.querySelector('[data-klant-item]');
  if (!klantEl) {
    console.error(`${LOG} ❌ Klant template [data-klant-item] niet gevonden bij init`);
    return false;
  }
  state.templates.klantItemParent = klantEl.parentElement;
  state.templates.klantItem = klantEl.cloneNode(true); // pristine deep clone
  klantEl.remove();
  console.log(`${LOG} ✅ Klant template gecacht`);

  // Plaats option template (optioneel)
  const plaatsEl = document.querySelector('[data-klanten-plaats-option]');
  if (plaatsEl) {
    state.templates.plaatsOptionParent = plaatsEl.parentElement;
    state.templates.plaatsOption = plaatsEl.cloneNode(true);
    plaatsEl.remove();
    console.log(`${LOG} ✅ Plaats option template gecacht`);
  } else {
    console.warn(`${LOG} ℹ️ Geen [data-klanten-plaats-option] gevonden - plaats filter niet beschikbaar`);
  }

  return true;
}

function renderNestedAbos(clone, abos) {
  const stateHas = clone.querySelector('[data-klant-abos-state="heeft-items"]');
  const stateNone = clone.querySelector('[data-klant-abos-state="geen-items"]');
  const nestedTpl = clone.querySelector('[data-klant-abo-item]');

  if (!nestedTpl) return; // geen nested template - skip

  const nestedParent = nestedTpl.parentElement;
  // Haal de originele template uit de outer clone; we renderen clones in zijn plaats
  nestedTpl.remove();

  if (!abos || abos.length === 0) {
    if (stateHas) stateHas.style.display = 'none';
    if (stateNone) stateNone.style.display = 'block';
    return;
  }

  if (stateHas) stateHas.style.display = 'block';
  if (stateNone) stateNone.style.display = 'none';

  abos.forEach((abo) => {
    const item = nestedTpl.cloneNode(true);
    item.setAttribute('data-klant-abo-item-id', abo.id);
    item.style.display = '';

    const idEl = item.querySelector('[data-klant-abo-id]');
    if (idEl) idEl.textContent = abo.id;

    const freqEl = item.querySelector('[data-klant-abo-frequentie]');
    if (freqEl) freqEl.textContent = formatFrequentie(abo.frequentie);

    const urenEl = item.querySelector('[data-klant-abo-uren]');
    if (urenEl) urenEl.textContent = abo.uren ? `${abo.uren} uur` : '-';

    const statusEl = item.querySelector('[data-klant-abo-status]');
    if (statusEl) {
      statusEl.textContent = formatAboStatus(abo.status);
      addStatusClass(statusEl, abo.status, 'abo');
    }

    nestedParent.appendChild(item);
  });
}

function renderNestedEenmalig(clone, opdrachten) {
  const stateHas = clone.querySelector('[data-klant-eenmalig-state="heeft-items"]');
  const stateNone = clone.querySelector('[data-klant-eenmalig-state="geen-items"]');
  const nestedTpl = clone.querySelector('[data-klant-eenmalig-item]');

  if (!nestedTpl) return;

  const nestedParent = nestedTpl.parentElement;
  nestedTpl.remove();

  if (!opdrachten || opdrachten.length === 0) {
    if (stateHas) stateHas.style.display = 'none';
    if (stateNone) stateNone.style.display = 'block';
    return;
  }

  if (stateHas) stateHas.style.display = 'block';
  if (stateNone) stateNone.style.display = 'none';

  opdrachten.forEach((op) => {
    const item = nestedTpl.cloneNode(true);
    item.setAttribute('data-klant-eenmalig-item-id', op.id);
    item.style.display = '';

    const idEl = item.querySelector('[data-klant-eenmalig-id]');
    if (idEl) idEl.textContent = op.id;

    const typeEl = item.querySelector('[data-klant-eenmalig-type]');
    if (typeEl) typeEl.textContent = formatEenmaligType(op.type);

    const urenEl = item.querySelector('[data-klant-eenmalig-uren]');
    if (urenEl) urenEl.textContent = op.uren != null ? `${op.uren} uur` : 'Onbekend';

    const statusEl = item.querySelector('[data-klant-eenmalig-status]');
    if (statusEl) {
      statusEl.textContent = formatOpdrachtStatus(op.status);
      addStatusClass(statusEl, op.status, 'opdracht');
    }

    nestedParent.appendChild(item);
  });
}

function renderKlantenList() {
  const listHas = document.querySelector('[data-klanten-state="heeft-items"]');
  const listNone = document.querySelector('[data-klanten-state="geen-items"]');
  const tpl = state.templates.klantItem;
  const parent = state.templates.klantItemParent;

  if (!tpl || !parent) {
    console.error(`${LOG} ❌ Klant template niet gecacht - kan niet renderen`);
    return;
  }

  // Verwijder alle eerder gerenderde klant items uit de parent
  parent.querySelectorAll('[data-klant-item]').forEach((el) => el.remove());

  // Paginatie slicen
  const filtered = state.filtered;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  if (pageItems.length === 0) {
    if (listHas) listHas.style.display = 'none';
    if (listNone) listNone.style.display = 'block';
    renderPagination(totalPages);
    return;
  }

  if (listHas) listHas.style.display = 'block';
  if (listNone) listNone.style.display = 'none';

  pageItems.forEach((klant) => {
    const clone = tpl.cloneNode(true);
    clone.setAttribute('data-klant-item-id', klant.id);
    clone.style.display = '';

    // Basis velden
    const naamEl = clone.querySelector('[data-klant-naam]');
    if (naamEl)
      naamEl.textContent = `${klant.voornaam || ''} ${klant.achternaam || ''}`.trim() || '-';

    const emailEl = clone.querySelector('[data-klant-email]');
    if (emailEl) emailEl.textContent = klant.email || '-';

    const telEl = clone.querySelector('[data-klant-telefoon]');
    if (telEl) telEl.textContent = klant.telefoon || '-';

    const straatEl = clone.querySelector('[data-klant-straat]');
    if (straatEl) {
      const a = klant.adres;
      straatEl.textContent = a
        ? [a.straat, a.huisnummer, a.toevoeging].filter(Boolean).join(' ') || '-'
        : '-';
    }

    const postcodeEl = clone.querySelector('[data-klant-postcode]');
    if (postcodeEl) postcodeEl.textContent = klant.adres?.postcode || '-';

    const plaatsEl = clone.querySelector('[data-klant-plaats]');
    if (plaatsEl) plaatsEl.textContent = klant.adres?.plaats || '-';

    const aangemaaktEl = clone.querySelector('[data-klant-aangemaakt]');
    if (aangemaaktEl) aangemaaktEl.textContent = formatDatum(klant.aangemaakt_op);

    // Nested lijsten
    renderNestedAbos(clone, klant.abonnementen);
    renderNestedEenmalig(clone, klant.opdrachten);

    // Klant-item = detail button (element heeft zelf data-klant-detail-btn),
    // of er zit een los data-klant-detail-btn element in.
    if (clone.hasAttribute('data-klant-detail-btn')) {
      clone.style.cursor = 'pointer';
      clone.addEventListener('click', (e) => {
        if (
          e.target.closest('button, a, input, label') &&
          !e.target.closest('[data-klant-detail-btn]')
        ) {
          return;
        }
        e.preventDefault();
        window.location.href = `/dashboard/admin/klant?id=${klant.id}`;
      });
    } else {
      const btn = clone.querySelector('[data-klant-detail-btn]');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = `/dashboard/admin/klant?id=${klant.id}`;
        });
      }
    }

    parent.appendChild(clone);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const wrapper = document.querySelector('[data-klanten-pagination]');
  const prev = document.querySelector('[data-klanten-page-prev]');
  const next = document.querySelector('[data-klanten-page-next]');

  if (wrapper) {
    wrapper.style.display = totalPages <= 1 ? 'none' : '';
  }
  if (prev) {
    prev.toggleAttribute('disabled', state.page <= 1);
    prev.classList.toggle('is-disabled', state.page <= 1);
  }
  if (next) {
    next.toggleAttribute('disabled', state.page >= totalPages);
    next.classList.toggle('is-disabled', state.page >= totalPages);
  }
}

function rerender() {
  state.filtered = applySort(applyFilters(state.allKlanten));
  renderCounts(state.filtered.length);
  renderSortActive();
  renderKlantenList();
}

// =============================================================================
// PLAATS FILTER - dynamische checkbox opties
// =============================================================================
function renderPlaatsOptions() {
  const tpl = state.templates.plaatsOption;
  const parent = state.templates.plaatsOptionParent;
  if (!tpl || !parent) return; // geen plaats filter op deze pagina

  // Verwijder eerder gerenderde opties uit parent
  parent.querySelectorAll('[data-klanten-plaats-option]').forEach((el) => el.remove());

  // Unieke plaatsen uit klantenlijst
  const set = new Set();
  state.allKlanten.forEach((k) => {
    const p = k.adres?.plaats;
    if (p) set.add(p);
  });
  state.plaatsOptions = [...set].sort((a, b) => a.localeCompare(b, 'nl'));
  console.log(`${LOG} 📍 ${state.plaatsOptions.length} unieke plaatsen gevonden`);

  state.plaatsOptions.forEach((plaats) => {
    const item = tpl.cloneNode(true);
    item.style.display = '';

    const input = item.querySelector('input[type="checkbox"]');
    const label = item.querySelector('[data-klanten-plaats-label], span');

    if (input) {
      input.value = plaats;
      input.checked = state.filters.plaatsen.has(plaats);
      input.addEventListener('change', () => {
        if (input.checked) state.filters.plaatsen.add(plaats);
        else state.filters.plaatsen.delete(plaats);
        state.page = 1;
        rerender();
      });
    }
    if (label) label.textContent = plaats;

    parent.appendChild(item);
  });
}

// =============================================================================
// FILTER EVENTS
// =============================================================================
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function bindFilterEvents() {
  const found = {
    search: 0, searchClear: 0,
    plaatsClear: 0,
    heeftAbo: 0, heeftAboClear: 0,
    aboStatus: 0, aboStatusClear: 0,
    heeftEenmalig: 0, heeftEenmaligClear: 0,
    eenmaligStatus: 0, eenmaligStatusClear: 0,
    datumVan: 0, datumTot: 0, datumClear: 0,
    resetAll: 0, sort: 0, pagePrev: 0, pageNext: 0,
  };

  // --- Zoekveld ---
  const searchInput = document.querySelector('[data-klanten-search-input]');
  if (searchInput) {
    found.search = 1;
    const handler = debounce(() => {
      state.filters.search = searchInput.value || '';
      state.page = 1;
      rerender();
    }, SEARCH_DEBOUNCE_MS);
    searchInput.addEventListener('input', handler);
  }
  const searchClear = document.querySelector('[data-klanten-search-clear]');
  if (searchClear) {
    found.searchClear = 1;
    searchClear.addEventListener('click', (e) => {
      e.preventDefault();
      if (searchInput) searchInput.value = '';
      state.filters.search = '';
      state.page = 1;
      rerender();
    });
  }

  // --- Plaats clear ---
  const plaatsClear = document.querySelector('[data-klanten-plaats-clear]');
  if (plaatsClear) {
    found.plaatsClear = 1;
    plaatsClear.addEventListener('click', (e) => {
      e.preventDefault();
      state.filters.plaatsen.clear();
      document
        .querySelectorAll('[data-klanten-plaats-option] input[type="checkbox"]')
        .forEach((cb) => (cb.checked = false));
      state.page = 1;
      rerender();
    });
  }

  // --- Heeft abonnement ---
  const heeftAboCb = document.querySelector('[data-klanten-filter-heeft-abo]');
  if (heeftAboCb) {
    found.heeftAbo = 1;
    heeftAboCb.addEventListener('change', () => {
      state.filters.heeftAbo = !!heeftAboCb.checked;
      state.page = 1;
      rerender();
    });
  }
  const heeftAboClear = document.querySelector('[data-klanten-filter-heeft-abo-clear]');
  if (heeftAboClear) {
    found.heeftAboClear = 1;
    heeftAboClear.addEventListener('click', (e) => {
      e.preventDefault();
      state.filters.heeftAbo = false;
      if (heeftAboCb) heeftAboCb.checked = false;
      state.page = 1;
      rerender();
    });
  }

  // --- Abonnement status (meerdere checkboxes) ---
  const aboStatusCbs = document.querySelectorAll('[data-klanten-filter-abo-status]');
  found.aboStatus = aboStatusCbs.length;
  aboStatusCbs.forEach((cb) => {
    cb.addEventListener('change', () => {
      const raw = cb.getAttribute('data-klanten-filter-abo-status');
      const v = ABO_STATUS_MAP[raw] || raw;
      console.log(`${LOG} 🔘 Abo status filter: ${raw} → ${v} (${cb.checked})`);
      if (cb.checked) state.filters.aboStatus.add(v);
      else state.filters.aboStatus.delete(v);
      state.page = 1;
      rerender();
    });
  });
  const aboStatusClear = document.querySelector('[data-klanten-filter-abo-status-clear]');
  if (aboStatusClear) {
    found.aboStatusClear = 1;
    aboStatusClear.addEventListener('click', (e) => {
      e.preventDefault();
      state.filters.aboStatus.clear();
      document
        .querySelectorAll('[data-klanten-filter-abo-status]')
        .forEach((cb) => (cb.checked = false));
      state.page = 1;
      rerender();
    });
  }

  // --- Heeft eenmalig ---
  const heeftEenmaligCb = document.querySelector('[data-klanten-filter-heeft-eenmalig]');
  if (heeftEenmaligCb) {
    found.heeftEenmalig = 1;
    heeftEenmaligCb.addEventListener('change', () => {
      state.filters.heeftEenmalig = !!heeftEenmaligCb.checked;
      state.page = 1;
      rerender();
    });
  }
  const heeftEenmaligClear = document.querySelector('[data-klanten-filter-heeft-eenmalig-clear]');
  if (heeftEenmaligClear) {
    found.heeftEenmaligClear = 1;
    heeftEenmaligClear.addEventListener('click', (e) => {
      e.preventDefault();
      state.filters.heeftEenmalig = false;
      if (heeftEenmaligCb) heeftEenmaligCb.checked = false;
      state.page = 1;
      rerender();
    });
  }

  // --- Eenmalig status ---
  const eenmaligStatusCbs = document.querySelectorAll('[data-klanten-filter-eenmalig-status]');
  found.eenmaligStatus = eenmaligStatusCbs.length;
  eenmaligStatusCbs.forEach((cb) => {
    cb.addEventListener('change', () => {
      const raw = cb.getAttribute('data-klanten-filter-eenmalig-status');
      const v = EENMALIG_STATUS_MAP[raw] || raw;
      console.log(`${LOG} 🔘 Eenmalig status filter: ${raw} → ${v} (${cb.checked})`);
      if (cb.checked) state.filters.eenmaligStatus.add(v);
      else state.filters.eenmaligStatus.delete(v);
      state.page = 1;
      rerender();
    });
  });
  const eenmaligStatusClear = document.querySelector('[data-klanten-filter-eenmalig-status-clear]');
  if (eenmaligStatusClear) {
    found.eenmaligStatusClear = 1;
    eenmaligStatusClear.addEventListener('click', (e) => {
      e.preventDefault();
      state.filters.eenmaligStatus.clear();
      document
        .querySelectorAll('[data-klanten-filter-eenmalig-status]')
        .forEach((cb) => (cb.checked = false));
      state.page = 1;
      rerender();
    });
  }

  // --- Datum range ---
  // Webflow kan geen data-attributen op form inputs zetten via 'Custom attribute',
  // dus we vallen terug op id-selector als het data-attribuut ontbreekt.
  const datumVan =
    document.querySelector('[data-klanten-filter-datum-van]') ||
    document.getElementById('data-klanten-filter-datum-van');
  const datumTot =
    document.querySelector('[data-klanten-filter-datum-tot]') ||
    document.getElementById('data-klanten-filter-datum-tot');
  if (datumVan) {
    found.datumVan = 1;
    const handler = () => {
      state.filters.datumVan = datumVan.value || '';
      console.log(`${LOG} 📅 Datum van: ${state.filters.datumVan}`);
      state.page = 1;
      rerender();
    };
    datumVan.addEventListener('change', handler);
    datumVan.addEventListener('input', handler);
  }
  if (datumTot) {
    found.datumTot = 1;
    const handler = () => {
      state.filters.datumTot = datumTot.value || '';
      console.log(`${LOG} 📅 Datum tot: ${state.filters.datumTot}`);
      state.page = 1;
      rerender();
    };
    datumTot.addEventListener('change', handler);
    datumTot.addEventListener('input', handler);
  }
  const datumClear = document.querySelector('[data-klanten-filter-datum-clear]');
  if (datumClear) {
    found.datumClear = 1;
    datumClear.addEventListener('click', (e) => {
      e.preventDefault();
      state.filters.datumVan = '';
      state.filters.datumTot = '';
      if (datumVan) datumVan.value = '';
      if (datumTot) datumTot.value = '';
      state.page = 1;
      rerender();
    });
  }

  // --- Reset all ---
  const resetAll = document.querySelector('[data-klanten-filter-reset-all]');
  if (resetAll) {
    found.resetAll = 1;
    resetAll.addEventListener('click', (e) => {
      e.preventDefault();
      resetAllFilters();
    });
  }

  // --- Sort buttons ---
  const sortBtns = document.querySelectorAll('[data-klanten-sort]');
  found.sort = sortBtns.length;
  sortBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const value = btn.getAttribute('data-klanten-sort');
      if (!value) return;
      state.sort = value;
      state.page = 1;
      rerender();
    });
  });

  // --- Pagination ---
  const prev = document.querySelector('[data-klanten-page-prev]');
  if (prev) {
    found.pagePrev = 1;
    prev.addEventListener('click', (e) => {
      e.preventDefault();
      if (state.page > 1) {
        state.page -= 1;
        renderKlantenList();
        scrollTopOfList();
      }
    });
  }
  const next = document.querySelector('[data-klanten-page-next]');
  if (next) {
    found.pageNext = 1;
    next.addEventListener('click', (e) => {
      e.preventDefault();
      const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
      if (state.page < totalPages) {
        state.page += 1;
        renderKlantenList();
        scrollTopOfList();
      }
    });
  }

  console.log(`${LOG} 🔗 Filter elements bound:`, found);
  const missing = Object.entries(found).filter(([, v]) => v === 0).map(([k]) => k);
  if (missing.length) {
    console.warn(`${LOG} ⚠️ Niet gevonden filter elementen:`, missing);
  }
}

function resetAllFilters() {
  state.filters.search = '';
  state.filters.plaatsen.clear();
  state.filters.heeftAbo = false;
  state.filters.aboStatus.clear();
  state.filters.heeftEenmalig = false;
  state.filters.eenmaligStatus.clear();
  state.filters.datumVan = '';
  state.filters.datumTot = '';
  state.sort = 'aangemaakt-desc';
  state.page = 1;

  const searchInput = document.querySelector('[data-klanten-search-input]');
  if (searchInput) searchInput.value = '';

  document
    .querySelectorAll('[data-klanten-plaats-option] input[type="checkbox"]')
    .forEach((cb) => (cb.checked = false));

  const heeftAboCb = document.querySelector('[data-klanten-filter-heeft-abo]');
  if (heeftAboCb) heeftAboCb.checked = false;

  document
    .querySelectorAll('[data-klanten-filter-abo-status]')
    .forEach((cb) => (cb.checked = false));

  const heeftEenmaligCb = document.querySelector(
    '[data-klanten-filter-heeft-eenmalig]'
  );
  if (heeftEenmaligCb) heeftEenmaligCb.checked = false;

  document
    .querySelectorAll('[data-klanten-filter-eenmalig-status]')
    .forEach((cb) => (cb.checked = false));

  const datumVan =
    document.querySelector('[data-klanten-filter-datum-van]') ||
    document.getElementById('data-klanten-filter-datum-van');
  const datumTot =
    document.querySelector('[data-klanten-filter-datum-tot]') ||
    document.getElementById('data-klanten-filter-datum-tot');
  if (datumVan) datumVan.value = '';
  if (datumTot) datumTot.value = '';

  rerender();
}

function scrollTopOfList() {
  const listHas = document.querySelector('[data-klanten-state="heeft-items"]');
  if (listHas && typeof listHas.scrollIntoView === 'function') {
    listHas.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// =============================================================================
// DATA LOADING
// =============================================================================
async function loadKlanten() {
  console.log(`${LOG} 🔄 Klanten ophalen…`);
  const authState = authClient.getAuthState();
  if (!authState?.access_token) {
    throw new Error('Niet ingelogd');
  }

  const response = await apiClient('/routes/dashboard/admin/klanten', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authState.access_token}`,
    },
  });

  if (!response?.success) {
    throw new Error(response?.error || 'Kon klanten niet ophalen');
  }

  state.allKlanten = Array.isArray(response.data) ? response.data : [];
  console.log(`${LOG} ✅ ${state.allKlanten.length} klanten geladen`);
}

// =============================================================================
// INIT
// =============================================================================
export async function initAdminKlantenOverview() {
  console.log(`${LOG} 🚀 Initialiseren…`);
  showLoading();

  try {
    // 1. Cache templates VOOR data loading - originelen gaan uit DOM
    if (!cacheTemplates()) {
      throw new Error('Template caching mislukt - check of [data-klant-item] op de pagina staat');
    }

    // 2. Data ophalen
    await loadKlanten();

    // 3. Plaats opties renderen + filter events binden
    renderPlaatsOptions();
    bindFilterEvents();

    // 4. Eerste render
    rerender();
    showContent();
    console.log(`${LOG} ✅ Klaar`);
  } catch (error) {
    console.error(`${LOG} ❌ Init error:`, error);
    showError(error?.message || 'Kon klanten niet laden');
  }
}
