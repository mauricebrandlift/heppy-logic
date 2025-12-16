// public/forms/dashboardKlant/opdrachtenDetailInit.js
/**
 * Dashboard Eenmalige Opdracht Detail initialisatie voor klanten
 * Haalt opdracht details op en toont op de pagina
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Formatteer datum naar NL formaat
 */
function formatDatum(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-NL', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

/**
 * Formatteer dagdelen voorkeur voor weergave
 * @param {Object} dagdelenVoorkeur - Object met dagdelen: { "maandag": ["ochtend", "middag"] }
 * @param {boolean} geenVoorkeur - Of "geen voorkeur" is geselecteerd
 * @returns {string} - Geformatteerde string
 */
function formatDagdelen(dagdelenVoorkeur, geenVoorkeur) {
  if (geenVoorkeur) {
    return 'Geen voorkeur';
  }
  
  if (!dagdelenVoorkeur || Object.keys(dagdelenVoorkeur).length === 0) {
    return '-';
  }
  
  // Afkortingen voor dagen
  const dagAfkortingen = {
    maandag: 'Ma',
    dinsdag: 'Di',
    woensdag: 'Wo',
    donderdag: 'Do',
    vrijdag: 'Vr',
    zaterdag: 'Za',
    zondag: 'Zo'
  };
  
  const dagdelenStrings = [];
  for (const [dag, dagdelen] of Object.entries(dagdelenVoorkeur)) {
    const dagAfkorting = dagAfkortingen[dag] || dag;
    const dagdeelLabels = dagdelen.join(', ');
    dagdelenStrings.push(`${dagAfkorting}: ${dagdeelLabels}`);
  }
  
  return dagdelenStrings.join(' • ');
}

/**
 * Formatteer type opdracht voor weergave
 */
function formatType(type) {
  const mapping = {
    'dieptereiniging': 'Dieptereiniging',
    'verhuis': 'Verhuisschoonmaak',
    'tapijt': 'Tapijtreiniging',
    'vloer': 'Vloerreiniging',
    'bank': 'Bankreiniging'
  };
  return mapping[type] || type;
}

/**
 * Formatteer status voor weergave
 */
function formatStatus(status) {
  const mapping = {
    'aangevraagd': 'Aangevraagd',
    'gepland': 'Gepland',
    'voltooid': 'Voltooid',
    'geannuleerd': 'Geannuleerd'
  };
  return mapping[status] || status;
}

/**
 * Formatteer offerte status voor weergave
 */
function formatOfferteStatus(status) {
  const mapping = {
    'nog_niet_verstuurd': 'In voorbereiding',
    'verstuurd': 'Verstuurd',
    'goedgekeurd': 'Goedgekeurd',
    'afgewezen': 'Afgewezen'
  };
  return mapping[status] || status;
}

/**
 * Voeg status class toe aan element
 */
function addStatusClass(element, status) {
  if (!element) return;
  
  const statusClassMap = {
    'aangevraagd': 'is-pending',
    'gepland': 'is-active',
    'voltooid': 'is-success',
    'geannuleerd': 'is-unactive',
    // Offerte statussen
    'nog_niet_verstuurd': 'is-pending',
    'verstuurd': 'is-active',
    'goedgekeurd': 'is-success',
    'afgewezen': 'is-unactive'
  };
  
  const statusClass = statusClassMap[status] || 'is-pending';
  element.classList.add(statusClass);
}

/**
 * Voeg betaalstatus class toe aan element
 */
function addBetaalstatusClass(element, betaalstatus) {
  if (!element) return;
  
  const statusClassMap = {
    'n.v.t.': 'is-pending',        // Geel - nog geen betaling nodig (bv wacht op offerte)
    'openstaand': 'is-pending',    // Geel - moet nog betalen
    'betaald': 'is-active',        // Groen - betaling voltooid
    'mislukt': 'is-unactive',      // Rood - betaling mislukt
    'terugbetaald': 'is-unactive'  // Rood - terugbetaald (geannuleerd)
  };
  
  const statusClass = statusClassMap[betaalstatus] || 'is-pending';
  element.classList.add(statusClass);
}

/**
 * Formatteer bedrag naar euros
 */
function formatBedrag(bedrag) {
  if (!bedrag && bedrag !== 0) return '-';
  const num = typeof bedrag === 'number' ? bedrag : parseFloat(bedrag);
  return `€${num.toFixed(2).replace('.', ',')}`;
}

/**
 * Toon/verberg loading state
 */
function showLoading() {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  
  if (loadingState) loadingState.style.display = 'block';
  if (contentState) contentState.style.display = 'none';
}

function hideLoading() {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  
  if (loadingState) loadingState.style.display = 'none';
  if (contentState) contentState.style.display = 'block';
}

/**
 * Toon error message
 */
function showError(message) {
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  const errorContainer = document.querySelector('[data-dashboard-error]');
  
  // Verberg loading en content
  if (loadingState) loadingState.style.display = 'none';
  if (contentState) contentState.style.display = 'none';
  
  // Toon error
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  }
}

/**
 * Bouw detail info string op basis van type en gegevens
 */
function buildDetailInfo(type, gegevens) {
  if (!gegevens || Object.keys(gegevens).length === 0) return 'Geen details beschikbaar';
  
  // Type-specifieke detail formatting
  switch(type) {
    case 'dieptereiniging':
      // Voorbeeld: "3 slaapkamers, 2 badkamers, 1 toilet, 120 m²"
      const parts = [];
      if (gegevens.aantal_slaapkamers) parts.push(`${gegevens.aantal_slaapkamers} ${gegevens.aantal_slaapkamers === 1 ? 'slaapkamer' : 'slaapkamers'}`);
      if (gegevens.aantal_badkamers) parts.push(`${gegevens.aantal_badkamers} ${gegevens.aantal_badkamers === 1 ? 'badkamer' : 'badkamers'}`);
      if (gegevens.aantal_toiletten) parts.push(`${gegevens.aantal_toiletten} ${gegevens.aantal_toiletten === 1 ? 'toilet' : 'toiletten'}`);
      if (gegevens.vierkante_meters) parts.push(`${gegevens.vierkante_meters} m²`);
      return parts.length > 0 ? parts.join(', ') : 'Geen details beschikbaar';
      
    case 'verhuis':
      // Bijvoorbeeld: "3 kamers, 120 m²"
      const verhuisParts = [];
      if (gegevens.aantal_kamers) verhuisParts.push(`${gegevens.aantal_kamers} ${gegevens.aantal_kamers === 1 ? 'kamer' : 'kamers'}`);
      if (gegevens.vierkante_meters) verhuisParts.push(`${gegevens.vierkante_meters} m²`);
      return verhuisParts.length > 0 ? verhuisParts.join(', ') : 'Geen details beschikbaar';
      
    case 'tapijt':
      // Bijvoorbeeld: "15 m² tapijt"
      return gegevens.vierkante_meters ? `${gegevens.vierkante_meters} m²` : 'Geen details beschikbaar';
      
    case 'vloer':
      // Bijvoorbeeld: "Parket, 45 m²"
      const vloerParts = [];
      if (gegevens.vloertype) vloerParts.push(gegevens.vloertype);
      if (gegevens.vierkante_meters) vloerParts.push(`${gegevens.vierkante_meters} m²`);
      return vloerParts.length > 0 ? vloerParts.join(', ') : 'Geen details beschikbaar';
      
    case 'bank':
      // Bijvoorbeeld: "2 banken, 4 stoelen, 8 zitvlakken, 4 kussens"
      const bankParts = [];
      const banken = parseInt(gegevens.rbs_banken) || 0;
      const stoelen = parseInt(gegevens.rbs_stoelen) || 0;
      const zitvlakken = parseInt(gegevens.rbs_zitvlakken) || 0;
      const kussens = parseInt(gegevens.rbs_kussens) || 0;
      
      if (banken > 0) bankParts.push(`${banken} ${banken === 1 ? 'bank' : 'banken'}`);
      if (stoelen > 0) bankParts.push(`${stoelen} ${stoelen === 1 ? 'stoel' : 'stoelen'}`);
      if (zitvlakken > 0) bankParts.push(`${zitvlakken} ${zitvlakken === 1 ? 'zitvlak' : 'zitvlakken'}`);
      if (kussens > 0) bankParts.push(`${kussens} ${kussens === 1 ? 'kussen' : 'kussens'}`);
      
      return bankParts.length > 0 ? bankParts.join(', ') : 'Geen details beschikbaar';
      
    default:
      // Fallback voor onbekende types
      return 'Details niet beschikbaar voor dit type opdracht';
  }
}

/**
 * Vul opdracht header details in
 */
function populateOpdrachtHeader(data) {
  // Opdracht nummer (ID laatste 8 chars)
  const nummerEl = document.querySelector('[data-eo-nummer]');
  if (nummerEl && data.id) {
    nummerEl.textContent = `#${data.id.slice(-8).toUpperCase()}`;
  }

  // Type
  const typeEl = document.querySelector('[data-eo-type]');
  if (typeEl) {
    typeEl.textContent = formatType(data.type);
  }

  // Detail info (type-specifiek)
  const detailInfoEl = document.querySelector('[data-eo-detail-info]');
  if (detailInfoEl) {
    detailInfoEl.textContent = buildDetailInfo(data.type, data.gegevens);
  }

  // Gewenste datum OF dagdelen voorkeur
  const gewensteDatumEl = document.querySelector('[data-eo-gewenste-datum]');
  if (gewensteDatumEl) {
    // Check of er een gewenste_datum is, anders toon dagdelen
    if (data.gewenste_datum) {
      gewensteDatumEl.textContent = formatDatum(data.gewenste_datum);
    } else if (data.gegevens?.dagdelenVoorkeur || data.gegevens?.geenVoorkeurDagdelen) {
      // Toon dagdelen voorkeur
      gewensteDatumEl.textContent = formatDagdelen(data.gegevens.dagdelenVoorkeur, data.gegevens.geenVoorkeurDagdelen);
    } else {
      gewensteDatumEl.textContent = 'Geen voorkeur opgegeven';
    }
  }

  // Geplande datum (kan nog null zijn)
  const geplandeDatumEl = document.querySelector('[data-eo-geplande-datum]');
  if (geplandeDatumEl) {
    if (data.geplande_datum) {
      geplandeDatumEl.textContent = formatDatum(data.geplande_datum);
    } else {
      geplandeDatumEl.textContent = 'Nog niet ingepland';
    }
  }

  // Status
  const statusEl = document.querySelector('[data-eo-status]');
  if (statusEl) {
    // Vind het kind element met text-size-small
    const textEl = statusEl.querySelector('.text-size-small');
    if (textEl) {
      textEl.textContent = formatStatus(data.status);
    } else {
      statusEl.textContent = formatStatus(data.status);
    }
    addStatusClass(statusEl, data.status);
  }

  // Betaalstatus
  const betaalstatusEl = document.querySelector('[data-eo-betaalstatus]');
  if (betaalstatusEl) {
    // Vind het kind element met text-size-small
    const textEl = betaalstatusEl.querySelector('.text-size-small');
    if (textEl) {
      textEl.textContent = data.betaalstatus || 'n.v.t.';
    } else {
      betaalstatusEl.textContent = data.betaalstatus || 'n.v.t.';
    }
    addBetaalstatusClass(betaalstatusEl, data.betaalstatus);
  }

  // Adres
  if (data.adres) {
    const adresEl = document.querySelector('[data-eo-adres]');
    if (adresEl) {
      const adres = `${data.adres.straat} ${data.adres.huisnummer}${data.adres.toevoeging ? ' ' + data.adres.toevoeging : ''}, ${data.adres.postcode} ${data.adres.plaats}`;
      adresEl.textContent = adres;
    }
  }

  // Spoed indicator
  const spoedEl = document.querySelector('[data-eo-spoed-indicator]');
  if (spoedEl) {
    spoedEl.textContent = data.is_spoed ? 'Ja' : 'Nee';
  }

  // Totaal bedrag
  const totaalBedragEl = document.querySelector('[data-eo-totaal-bedrag]');
  if (totaalBedragEl) {
    totaalBedragEl.textContent = formatBedrag(data.totaalbedrag);
  }

  // Opmerkingen
  const opmerkingenEl = document.querySelector('[data-eo-opmerkingen]');
  if (opmerkingenEl) {
    opmerkingenEl.textContent = data.opmerking || '-';
  }
}

/**
 * Vul schoonmaker sectie in
 */
function populateSchoonmakerSection(data) {
  const schoonmakerSection = document.querySelector('[data-schoonmaker-section]');
  const geenSchoonmakerSection = document.querySelector('[data-geen-schoonmaker-section]');

  if (!data.schoonmaker || !data.schoonmaker.id) {
    // Geen schoonmaker toegewezen
    if (schoonmakerSection) schoonmakerSection.style.display = 'none';
    if (geenSchoonmakerSection) geenSchoonmakerSection.style.display = 'block';
    return;
  }

  // Wel schoonmaker toegewezen
  if (schoonmakerSection) schoonmakerSection.style.display = 'block';
  if (geenSchoonmakerSection) geenSchoonmakerSection.style.display = 'none';

  const schoonmaker = data.schoonmaker;

  // Naam
  const naamEl = document.querySelector('[data-schoonmaker-naam]');
  if (naamEl) {
    naamEl.textContent = `${schoonmaker.voornaam} ${schoonmaker.achternaam}`;
  }

  // Plaats
  const plaatsEl = document.querySelector('[data-schoonmaker-plaats]');
  if (plaatsEl && schoonmaker.plaats) {
    plaatsEl.textContent = schoonmaker.plaats;
  }

  // Foto
  const fotoEl = document.querySelector('[data-schoonmaker-foto]');
  if (fotoEl && schoonmaker.profielfoto) {
    fotoEl.src = schoonmaker.profielfoto;
    fotoEl.alt = `${schoonmaker.voornaam} ${schoonmaker.achternaam}`;
  }

  // Contact info
  const emailEl = document.querySelector('[data-schoonmaker-email]');
  const telefoonEl = document.querySelector('[data-schoonmaker-telefoon]');

  if (emailEl && schoonmaker.email) emailEl.textContent = schoonmaker.email;
  if (telefoonEl && schoonmaker.telefoon) telefoonEl.textContent = schoonmaker.telefoon;

  // Profiel bekijken button
  const profielBtn = document.querySelector('[data-schoonmaker-profiel-btn]');
  if (profielBtn) {
    profielBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `/dashboard/klant/schoonmaker-profiel?id=${schoonmaker.id}&context=opdracht`;
    });
  }
}

/**
 * Bepaal welke wrapper(s) te tonen: offerte, factuur, of in-behandeling
 */
function handleConditionalWrappers(data) {
  const offerteWrapper = document.querySelector('[data-offerte-wrapper]');
  const factuurWrapper = document.querySelector('[data-factuur-wrapper]');
  const inBehandelingWrapper = document.querySelector('[data-in-behandeling-wrapper]');

  // Check of type een offerte flow heeft
  const offerteTypes = ['tapijt', 'vloer', 'bank'];
  const isOfferteType = offerteTypes.includes(data.type);

  // Verberg alles standaard
  if (offerteWrapper) offerteWrapper.style.display = 'none';
  if (factuurWrapper) factuurWrapper.style.display = 'none';
  if (inBehandelingWrapper) inBehandelingWrapper.style.display = 'none';

  // === OFFERTE FLOW ===
  if (isOfferteType && data.offerte_status) {
    // Toon offerte wrapper
    if (offerteWrapper) {
      offerteWrapper.style.display = 'block';
      
      // Vul offerte details
      const offerteStatusEl = document.querySelector('[data-eo-offerte-status]');
      const offerteBedragEl = document.querySelector('[data-eo-offerte-bedrag]');
      const offerteDatumEl = document.querySelector('[data-eo-offerte-datum]');
      const offerteButton = offerteWrapper.querySelector('[data-invoice-button]');

      if (offerteStatusEl) {
        // Vind het kind element met text-size-small
        const textEl = offerteStatusEl.querySelector('.text-size-small');
        if (textEl) {
          textEl.textContent = formatOfferteStatus(data.offerte_status);
        } else {
          offerteStatusEl.textContent = formatOfferteStatus(data.offerte_status);
        }
        addStatusClass(offerteStatusEl, data.offerte_status);
      }
      if (offerteBedragEl) {
        offerteBedragEl.textContent = data.offerte_bedrag ? formatBedrag(data.offerte_bedrag) : '-';
      }
      if (offerteDatumEl) {
        offerteDatumEl.textContent = formatDatum(data.offerte_datum);
      }

      // Button alleen tonen als offerte verstuurd of goedgekeurd is
      if (offerteButton) {
        if (data.offerte_status === 'verstuurd' || data.offerte_status === 'goedgekeurd') {
          offerteButton.style.display = 'inline-block';
          // TODO: Link naar offerte PDF/pagina
          offerteButton.href = `/offerte/${data.id}`;
        } else {
          offerteButton.style.display = 'none';
        }
      }
    }

    // In behandeling tekst voor offerte flow
    if (data.offerte_status === 'nog_niet_verstuurd' && inBehandelingWrapper) {
      inBehandelingWrapper.style.display = 'block';
      const tekstEl = document.querySelector('[data-in-behandeling-tekst]');
      if (tekstEl) {
        tekstEl.textContent = 'We bereiden een offerte voor. Je ontvangt deze binnen 2 werkdagen.';
      }
    } else if (data.offerte_status === 'verstuurd' && inBehandelingWrapper) {
      inBehandelingWrapper.style.display = 'block';
      const tekstEl = document.querySelector('[data-in-behandeling-tekst]');
      if (tekstEl) {
        tekstEl.textContent = 'Je offerte is klaar! Bekijk en accepteer de offerte om verder te gaan.';
      }
    }
  }
  // === DIRECT PAYMENT FLOW ===
  else {
    // Factuur button tonen als betaald
    if (data.betaalstatus === 'betaald' && factuurWrapper) {
      factuurWrapper.style.display = 'block';
      const factuurButton = factuurWrapper.querySelector('[data-invoice-button]');
      if (factuurButton) {
        // TODO: Link naar factuur PDF/pagina
        factuurButton.href = `/factuur/${data.id}`;
      }
    }

    // In behandeling tekst voor direct payment
    if (data.status === 'aangevraagd' && inBehandelingWrapper) {
      inBehandelingWrapper.style.display = 'block';
      const tekstEl = document.querySelector('[data-in-behandeling-tekst]');
      if (tekstEl) {
        tekstEl.textContent = 'We zoeken een geschikte schoonmaker voor jouw opdracht.';
      }
    } else if (data.status === 'gepland' && !data.schoonmaker_id && inBehandelingWrapper) {
      inBehandelingWrapper.style.display = 'block';
      const tekstEl = document.querySelector('[data-in-behandeling-tekst]');
      if (tekstEl) {
        tekstEl.textContent = 'Je opdracht is gepland, maar er is nog geen schoonmaker toegewezen.';
      }
    }
  }
}

/**
 * Haal opdracht details op van backend
 */
async function fetchOpdrachtDetails() {
  try {
    // Haal opdracht ID uit URL
    const urlParams = new URLSearchParams(window.location.search);
    const opdrachtId = urlParams.get('id');

    if (!opdrachtId) {
      throw new Error('Geen opdracht ID gevonden in URL');
    }

    console.log('🔄 [Opdracht Detail] Ophalen opdracht details...', opdrachtId);
    showLoading();

    const authState = authClient.getAuthState();
    if (!authState) {
      throw new Error('Niet geauthenticeerd');
    }

    const response = await apiClient(`/routes/dashboard/klant/opdracht-detail?id=${opdrachtId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [Opdracht Detail] Opdracht details opgehaald');

    // Vul pagina met data
    populateOpdrachtHeader(response);
    populateSchoonmakerSection(response);
    handleConditionalWrappers(response);

    hideLoading();

  } catch (error) {
    console.error('❌ [Opdracht Detail] Fout bij ophalen:', error);
    showError(error.message || 'Er is een fout opgetreden bij het ophalen van de opdracht');
  }
}

/**
 * Initialize opdracht detail pagina
 */
export async function initOpdrachtDetail() {
  console.log('🎯 [Opdracht Detail] Initialiseren...');
  
  // Fetch opdracht details
  await fetchOpdrachtDetails();
  
  console.log('✅ [Opdracht Detail] Initialisatie voltooid');
}
