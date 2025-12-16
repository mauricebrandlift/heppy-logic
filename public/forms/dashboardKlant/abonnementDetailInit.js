// public/forms/dashboardKlant/abonnementDetailInit.js
/**
 * Dashboard Abonnement Detail initialisatie voor klanten
 * Haalt abonnement details op en toont op de pagina
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';
import { hideAllSuccessMessages } from '../ui/formUi.js';

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
 * Haal jaar uit datum
 */
function getJaarFromDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.getFullYear();
}

/**
 * Haal weeknummer uit datum (ISO week)
 */
function getWeeknummerFromDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  
  // ISO week berekening
  const tempDate = new Date(date.valueOf());
  const dayNum = (date.getDay() + 6) % 7;
  tempDate.setDate(tempDate.getDate() - dayNum + 3);
  const firstThursday = tempDate.valueOf();
  tempDate.setMonth(0, 1);
  if (tempDate.getDay() !== 4) {
    tempDate.setMonth(0, 1 + ((4 - tempDate.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - tempDate) / 604800000);
}

/**
 * Formatteer frequentie voor weergave
 */
function formatFrequentie(frequentie) {
  const mapping = {
    'weekly': '1x per week',
    'perweek': '1x per week',
    'pertweeweek': '1x per 2 weken',
    'pervierweken': '1x per 4 weken',
    'eenmalig': 'Eenmalig'
  };
  return mapping[frequentie] || frequentie;
}

/**
 * Formatteer status voor weergave
 */
function formatStatus(status) {
  const mapping = {
    'wachtrij': 'Wachtrij',
    'actief': 'Actief',
    'gepauzeerd': 'Gepauzeerd',
    'gestopt': 'Gestopt'
  };
  return mapping[status] || status;
}

/**
 * Voeg status class toe aan element
 */
function addStatusClass(element, status) {
  if (!element) return;
  
  const statusClassMap = {
    'actief': 'is-active',
    'wachtrij': 'is-pending',
    'gepauzeerd': 'is-unactive',
    'gestopt': 'is-unactive'
  };
  
  const statusClass = statusClassMap[status] || 'is-pending';
  element.classList.add(statusClass);
}

/**
 * Formatteer bedrag in centen naar euros
 */
function formatBedrag(cents) {
  if (!cents && cents !== 0) return '-';
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
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
 * Vul abonnement header details in
 */
function populateAbonnementHeader(data) {
  // Abonnement nummer (ID laatste 8 chars)
  const nummerEl = document.querySelector('[data-abo-nummer]');
  if (nummerEl && data.id) {
    nummerEl.textContent = `ABO-${data.id.slice(-8).toUpperCase()}`;
  }

  // Start jaar en week
  const startJaarEl = document.querySelector('[data-abo-start-jaar]');
  const startWeekEl = document.querySelector('[data-abo-start-week]');
  
  if (startJaarEl) startJaarEl.textContent = getJaarFromDate(data.startdatum);
  if (startWeekEl) startWeekEl.textContent = `Week ${getWeeknummerFromDate(data.startdatum)}`;

  // Status
  const statusEl = document.querySelector('[data-abo-status]');
  if (statusEl) {
    statusEl.textContent = formatStatus(data.status);
    addStatusClass(statusEl, data.status);
  }

  // Adres
  if (data.adres) {
    const adresEl = document.querySelector('[data-abo-adres]');
    const postcodeEl = document.querySelector('[data-abo-postcode-plaats]');
    
    if (adresEl) {
      const adres = `${data.adres.straat} ${data.adres.huisnummer}${data.adres.toevoeging ? ' ' + data.adres.toevoeging : ''}`;
      adresEl.textContent = adres;
    }
    if (postcodeEl) {
      postcodeEl.textContent = `${data.adres.postcode} ${data.adres.plaats}`;
    }
  }

  // Huidige details
  const frequentieEl = document.querySelector('[data-abo-frequentie]');
  const urenEl = document.querySelector('[data-abo-uren]');
  const kostenEl = document.querySelector('[data-abo-kosten]');

  if (frequentieEl) frequentieEl.textContent = formatFrequentie(data.frequentie);
  if (urenEl) urenEl.textContent = `${data.uren} uur`;
  if (kostenEl && data.bundle_amount_cents) {
    kostenEl.textContent = formatBedrag(data.bundle_amount_cents);
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

  // Foto
  const fotoEl = document.querySelector('[data-schoonmaker-foto]');
  if (fotoEl && schoonmaker.profielfoto) {
    fotoEl.src = schoonmaker.profielfoto;
    fotoEl.alt = `${schoonmaker.voornaam} ${schoonmaker.achternaam}`;
  }

  // Bio (optioneel)
  const bioEl = document.querySelector('[data-schoonmaker-bio]');
  if (bioEl && schoonmaker.bio) {
    bioEl.textContent = schoonmaker.bio;
    bioEl.style.display = 'block';
  } else if (bioEl) {
    bioEl.style.display = 'none';
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
      // Later: Navigeer naar schoonmaker profiel pagina
      window.location.href = `/dashboard/klant/schoonmaker-profiel?id=${schoonmaker.id}&context=mijn-schoonmaker`;
    });
  }
}

/**
 * Initialiseer wijzigingen sectie (frequentie en uren wijzigen)
 */
function initializeWijzigingenSection(data) {
  // EERST: Maak hidden input aan VOORDAT formHandler initialiseert
  const formElement = document.querySelector('[data-form-name="abb_change-form"]');
  if (!formElement) {
    console.error('[Abonnement Detail] Form element niet gevonden');
    return;
  }

  let urenInput = formElement.querySelector('input[data-field-name="uren"]');
  if (!urenInput) {
    urenInput = document.createElement('input');
    urenInput.type = 'hidden';
    urenInput.setAttribute('data-field-name', 'uren');
    urenInput.value = data.uren;
    formElement.appendChild(urenInput);
    console.log('[Abonnement Detail] Hidden uren input aangemaakt met waarde:', data.uren);
  }

  import('../logic/formHandler.js').then(({ formHandler }) => {
    import('../schemas/formSchemas.js').then(({ getFormSchema }) => {
      const schema = getFormSchema('abb_change-form');
      if (!schema) {
        console.error('[Abonnement Detail] Schema abb_change-form niet gevonden');
        return;
      }

      // Prefill data vanuit abonnement
      // Converteer uren naar number voor correcte vergelijking
      const initialData = {
        frequentie: data.frequentie,
        uren: parseFloat(data.uren)
      };

      // Custom submit action
      schema.submit = {
        action: async (formData) => {
          const authState = authClient.getAuthState();
          const response = await apiClient('/routes/dashboard/klant/update-abonnement', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${authState.access_token}` },
            body: {
              id: data.id,
              frequentie: formData.frequentie,
              uren: formData.uren
            }
          });

          return { message: 'Abonnement succesvol bijgewerkt' };
        },
        onSuccess: () => {
          const formName = 'abb_change-form';
          formHandler.showSuccessState(formName, {
            messageAttribute: formName,
            hideForm: false,
            scrollIntoView: false
          });
          
          // Auto-hide success message after 5 seconds
          setTimeout(() => {
            const successEl = document.querySelector(`[data-success-message="${formName}"]`);
            if (successEl) successEl.style.display = 'none';
          }, 5000);

          // Reload page data om nieuwe waarden te tonen
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      };

      // Initialize form met change tracking
      formHandler.init(schema, initialData, { requireChanges: true });

      // Setup uren +/- buttons (geef urenInput door)
      setupUrenButtons(data, urenInput);
    });
  });
}

/**
 * Setup uren increment/decrement buttons
 */
function setupUrenButtons(data, urenInput) {
  const urenUpBtn = document.querySelector('[data-btn="uren_up"]');
  const urenDownBtn = document.querySelector('[data-btn="uren_down"]');
  const urenDisplay = document.querySelector('[data-field-total="calculate_form_abb_uren"]');
  const minUrenDisplay = document.querySelector('[data-abo-adres="min-uren"]');
  const urenError = document.querySelector('[data-error-for="uren"]');

  if (!urenUpBtn || !urenDownBtn || !urenDisplay || !urenInput) {
    console.warn('[Abonnement Detail] Uren buttons, display of input niet gevonden');
    return;
  }

  // Set initial values
  let currentUren = parseFloat(data.uren) || 3;
  const minimumUren = parseFloat(data.minimum_uren) || 3;

  urenDisplay.textContent = formatUren(currentUren);
  if (minUrenDisplay) minUrenDisplay.textContent = formatUren(minimumUren);

  // Set initial prijs
  const prijsDisplay = document.querySelector('[data-field-total="calculate_form_abb_prijs"]');
  if (prijsDisplay && data.prijs_per_sessie_cents) {
    const initieleprijs = data.prijs_per_sessie_cents / 100;
    prijsDisplay.textContent = initieleprijs.toFixed(2).replace('.', ',');
  }

  // Clear any existing errors
  if (urenError) {
    urenError.style.display = 'none';
  }

  // Bereken en update prijs
  const updatePrijsDisplay = (uren) => {
    const prijsDisplay = document.querySelector('[data-field-total="calculate_form_abb_prijs"]');
    if (!prijsDisplay || !data.prijs_per_sessie_cents) return;

    // Bereken prijs per uur
    const prijsPerUur = data.prijs_per_sessie_cents / (parseFloat(data.uren) || 1);
    const nieuwePrijs = (uren * prijsPerUur) / 100;
    
    prijsDisplay.textContent = nieuwePrijs.toFixed(2).replace('.', ',');
  };

  // Update hidden input voor formHandler
  const updateHiddenInput = (value) => {
    console.log('[Uren Button] Updating uren to:', value, 'type:', typeof value);
    
    // Update hidden input value
    urenInput.value = value;
    
    // Trigger change event voor formHandler
    const event = new Event('change', { bubbles: true });
    urenInput.dispatchEvent(event);
    
    import('../logic/formHandler.js').then(({ formHandler }) => {
      formHandler.runWithFormContext('abb_change-form', () => {
        console.log('[Uren Button] Before update - formData.uren:', formHandler.formData.uren, 'originalData.uren:', formHandler.originalData?.uren);
        
        // Store als number voor correcte vergelijking
        formHandler.formData.uren = value;
        
        console.log('[Uren Button] After update - formData.uren:', formHandler.formData.uren, 'originalData.uren:', formHandler.originalData?.uren);
        console.log('[Uren Button] Has changes?', formHandler._hasChanges());
        
        formHandler.updateSubmitState();
      });
    });
    
    // Update prijs display
    updatePrijsDisplay(value);
  };

  // Increment button
  urenUpBtn.addEventListener('click', (e) => {
    e.preventDefault();
    currentUren += 0.5;
    urenDisplay.textContent = formatUren(currentUren);
    
    // Clear error if present
    if (urenError) {
      urenError.style.display = 'none';
    }

    updateHiddenInput(currentUren);
  });

  // Decrement button
  urenDownBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Check minimum
    if (currentUren - 0.5 < minimumUren) {
      // Show error
      if (urenError) {
        urenError.textContent = `Het minimum aantal uren is ${formatUren(minimumUren)} uur`;
        urenError.style.display = 'block';
      }
      return;
    }

    currentUren -= 0.5;
    urenDisplay.textContent = formatUren(currentUren);
    
    // Clear error
    if (urenError) {
      urenError.style.display = 'none';
    }

    updateHiddenInput(currentUren);
  });
}

/**
 * Formatteer uren voor display (zonder .0)
 */
function formatUren(uren) {
  if (typeof uren !== 'number' || isNaN(uren)) {
    return '0';
  }
  const normalized = Math.round((uren + Number.EPSILON) * 2) / 2;
  const formatted = normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toFixed(1);
  return formatted.replace('.0', '');
}

/**
 * Initialiseer opzeggen sectie
 */
async function initializeOpzeggenSection(data) {
  console.log('🚫 [Abonnement Detail] Initialiseren opzeg sectie...');

  const actiefState = document.querySelector('[data-abonnementen-opzeg-state="is-actief"]');
  const opgezegtState = document.querySelector('[data-abonnementen-opzeg-state="is-opgezegd"]');
  
  // Check of abonnement al is opgezegd
  if (data.canceled_at) {
    console.log('ℹ️ [Abonnement Detail] Abonnement is al opgezegd:', data.canceled_at);
    
    // Toggle states
    if (actiefState) actiefState.style.display = 'none';
    if (opgezegtState) opgezegtState.style.display = 'block';
    
    // Vul opzeg informatie in
    const opzegInfo = document.querySelector('[data-opzeg-info]');
    if (opzegInfo) {
      const datum = new Date(data.canceled_at);
      const dag = String(datum.getDate()).padStart(2, '0');
      const maand = String(datum.getMonth() + 1).padStart(2, '0');
      const jaar = datum.getFullYear();
      const datumStr = `${dag}-${maand}-${jaar}`;
      
      let html = `<strong>Opzegdatum:</strong> ${datumStr}`;
      if (data.cancellation_reason) {
        html += `<br><strong>Reden:</strong> ${data.cancellation_reason}`;
      }
      
      opzegInfo.innerHTML = html;
    }
    
    return;
  }

  // Abonnement is actief - toon formulier
  if (actiefState) actiefState.style.display = 'block';
  if (opgezegtState) opgezegtState.style.display = 'none';

  const formElement = document.querySelector('[data-form-name="abb_opzeg-form"]');
  if (!formElement) {
    console.warn('⚠️ [Abonnement Detail] Opzeg formulier niet gevonden in DOM');
    return;
  }

  // Lazy load formHandler en dependencies
  const [
    { formHandler },
    { getFormSchema },
    { initWeekSelectTrigger }
  ] = await Promise.all([
    import('../logic/formHandler.js'),
    import('../schemas/formSchemas.js'),
    import('../logic/formTriggers.js')
  ]);

  const schema = getFormSchema('abb_opzeg-form');
  if (!schema) {
    console.error('❌ [Abonnement Detail] Schema voor abb_opzeg-form niet gevonden');
    return;
  }

  // Custom submit action
  schema.submit = {
    action: async (formData) => {
      console.log('📤 [Abonnement Detail] Submitting opzegging...', formData);

      // Haal jaar op uit hidden dataset attribuut (gezet door initWeekSelectTrigger)
      const weekInput = formElement.querySelector('[data-field-name="opzeg_weeknr"]');
      const opzeg_jaar = weekInput?.dataset.weekYear || new Date().getFullYear();

      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/klant/opzeg-abonnement', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          id: data.id,
          opzeg_weeknr: formData.opzeg_weeknr,
          opzeg_jaar: opzeg_jaar,
          opzeg_reden: formData.opzeg_reden || ''
        }
      });

      console.log('✅ [Abonnement Detail] Opzegging succesvol:', response);
      return { message: 'Abonnement succesvol opgezegd' };
    },
    onSuccess: () => {
      const formName = 'abb_opzeg-form';
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) successEl.style.display = 'none';
      }, 5000);

      // Reload page na 2 seconden om nieuwe status te tonen
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  // Initialize formHandler
  formHandler.init(schema);

  // Initialiseer week selector met 2 weken termijn en 26 weken vooruit
  initWeekSelectTrigger(formHandler, {
    weekField: 'opzeg_weeknr',
    infoField: 'opzeg_weeknr',
    maxWeeks: 26 // Half jaar vooruit is voldoende voor opzegging
  });

  console.log('✅ [Abonnement Detail] Opzeg formulier geïnitialiseerd');
}

/**
 * Initialiseer abonnement detail pagina
 */
export async function initAbonnementDetail() {
  console.log('📋 [Abonnement Detail] Initialiseren...');

  // Hide alle success messages bij laden
  hideAllSuccessMessages();

  // ⚠️ BELANGRIJK: Check authenticatie EERST voordat we iets doen
  // Dit voorkomt race conditions tijdens redirect
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Abonnement Detail] Geen authenticatie, stoppen met initialisatie');
    return; // Stop direct, laat dashboardAuth.js de redirect afhandelen
  }

  // Zet content direct op display none
  const contentState = document.querySelector('[data-content-state]');
  if (contentState) contentState.style.display = 'none';

  // Toon loading state
  showLoading();

  try {
    // Get abonnement ID from URL
    const params = new URLSearchParams(window.location.search);
    const abonnementId = params.get('id');

    if (!abonnementId) {
      showError('Geen abonnement ID gevonden in URL.');
      return;
    }

    // Haal abonnement data op
    console.log('🔄 [Abonnement Detail] Fetching data...', { abonnementId });
    const data = await apiClient(`/routes/dashboard/klant/abonnement-detail?id=${abonnementId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [Abonnement Detail] Data opgehaald:', data);

    // Vul pagina in
    populateAbonnementHeader(data);
    populateSchoonmakerSection(data);
    
    // Initialize placeholder sections (later implementeren)
    initializeWijzigingenSection(data);
    initializeOpzeggenSection(data);

    console.log('✅ [Abonnement Detail] Initialisatie voltooid');
    
    // Verberg loading, toon content
    hideLoading();

  } catch (error) {
    console.error('❌ [Abonnement Detail] Fout bij ophalen data:', error);
    showError('Er ging iets mis bij het laden van het abonnement. Probeer het opnieuw.');
  }
}
