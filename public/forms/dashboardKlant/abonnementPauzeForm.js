// public/forms/dashboardKlant/abonnementPauzeForm.js
/**
 * Pauze formulier voor abonnement detail pagina
 * Gebruikt weeknummer selectie zoals bij opzeggen
 * Toont pauze geschiedenis
 */

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { initWeekSelectTrigger } from '../logic/formTriggers.js';
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Render pauze geschiedenis in data-pauze-geschiedenis element
 */
function renderPauzeGeschiedenis(pauzes) {
  const geschiedenisEl = document.querySelector('[data-pauze-geschiedenis]');
  if (!geschiedenisEl) return;

  if (!pauzes || pauzes.length === 0) {
    geschiedenisEl.textContent = 'Nog geen pauzes aangevraagd';
    geschiedenisEl.style.fontStyle = 'italic';
    geschiedenisEl.style.color = '#666';
    return;
  }

  // Sorteer pauzes op startdatum (nieuwste eerst)
  const gesorteerd = [...pauzes].sort((a, b) => new Date(b.startdatum) - new Date(a.startdatum));

  const html = gesorteerd.map(pauze => {
    const startDate = new Date(pauze.startdatum);
    const endDate = new Date(pauze.einddatum);
    const startWeek = getISOWeek(startDate);
    const startYear = startDate.getFullYear();
    const endWeek = getISOWeek(endDate);
    const endYear = endDate.getFullYear();
    
    return `Week ${startWeek}, ${startYear} - Week ${endWeek}, ${endYear}`;
  }).join('<br>');

  geschiedenisEl.innerHTML = html;
  geschiedenisEl.style.fontStyle = 'normal';
  geschiedenisEl.style.color = 'inherit';
}

/**
 * Bereken ISO weeknummer voor een datum
 */
function getISOWeek(date) {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

/**
 * Custom validator voor eindweek (moet na startweek zijn)
 */
function validateEindweekAfterStart(formElement) {
  const startInput = formElement.querySelector('[data-field-name="pauze_start_weeknr"]');
  const eindInput = formElement.querySelector('[data-field-name="pauze_eind_weeknr"]');
  
  if (!startInput || !eindInput) return true;

  const startWeek = parseInt(startInput.value, 10);
  const eindWeek = parseInt(eindInput.value, 10);
  const startYear = parseInt(startInput.dataset.weekYear || new Date().getFullYear(), 10);
  const eindYear = parseInt(eindInput.dataset.weekYear || new Date().getFullYear(), 10);

  if (isNaN(startWeek) || isNaN(eindWeek)) return true;

  // Simpele check: zelfde jaar -> week nummer vergelijken
  // Anders jaar -> jaar vergelijken
  if (startYear === eindYear) {
    return eindWeek > startWeek;
  }
  
  return eindYear > startYear;
}

/**
 * Initialiseer pauze formulier
 * @param {Object} data - Abonnement data
 */
export async function initAbonnementPauzeForm(data) {
  console.log('⏸️ [Abonnement Pauze] Initialiseren pauze formulier...');

  // Haal pauze geschiedenis op en render
  try {
    const authState = authClient.getAuthState();
    const pauzes = await apiClient(`/routes/dashboard/klant/pauze-geschiedenis?abonnement_id=${data.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authState.access_token}` }
    });
    renderPauzeGeschiedenis(pauzes);
  } catch (error) {
    console.warn('⚠️ [Abonnement Pauze] Kon pauze geschiedenis niet ophalen:', error);
    renderPauzeGeschiedenis([]);
  }

  // Check of abonnement al gepauzeerd of opgezegd is
  if (data.status === 'gepauzeerd' || data.canceled_at) {
    console.warn('⚠️ [Abonnement Pauze] Abonnement is al gepauzeerd of opgezegd');
    return;
  }

  const formElement = document.querySelector('[data-form-name="abb_pauze-form"]');
  if (!formElement) {
    console.warn('⚠️ [Abonnement Pauze] Pauze formulier niet gevonden in DOM');
    return;
  }

  const schema = getFormSchema('abb_pauze-form');
  if (!schema) {
    console.error('❌ [Abonnement Pauze] Schema voor abb_pauze-form niet gevonden');
    return;
  }

  // Custom submit action
  schema.submit = {
    action: async (formData) => {
      console.log('📤 [Abonnement Pauze] Submitting pauze...', formData);

      // Haal jaren op uit hidden dataset attributen (gezet door initWeekSelectTrigger)
      const startInput = formElement.querySelector('[data-field-name="pauze_start_weeknr"]');
      const eindInput = formElement.querySelector('[data-field-name="pauze_eind_weeknr"]');
      const pauze_start_jaar = startInput?.dataset.weekYear || new Date().getFullYear();
      const pauze_eind_jaar = eindInput?.dataset.weekYear || new Date().getFullYear();

      // Extra validatie: eindweek moet na startweek zijn
      if (!validateEindweekAfterStart(formElement)) {
        throw new Error('INVALID_WEEK_RANGE');
      }

      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/klant/pauze-abonnement', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          id: data.id,
          pauze_start_weeknr: formData.pauze_start_weeknr,
          pauze_start_jaar: pauze_start_jaar,
          pauze_eind_weeknr: formData.pauze_eind_weeknr,
          pauze_eind_jaar: pauze_eind_jaar,
          pauze_reden: formData.pauze_reden || ''
        }
      });

      console.log('✅ [Abonnement Pauze] Pauze succesvol:', response);
      return { message: 'Abonnement succesvol gepauzeerd' };
    },
    onSuccess: () => {
      const formName = 'abb_pauze-form';
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

  // Helper functie: bereken week + 1 met jaarwisseling
  function getNextWeek(weekNum, year) {
    const weeksInYear = weeksInISOYear(year);
    let nextWeek = weekNum + 1;
    let nextYear = year;
    
    if (nextWeek > weeksInYear) {
      nextWeek = 1;
      nextYear = year + 1;
    }
    
    return { week: nextWeek, year: nextYear };
  }

  function weeksInISOYear(year) {
    const dec28 = new Date(Date.UTC(year, 11, 28));
    const tmp = new Date(Date.UTC(dec28.getFullYear(), dec28.getMonth(), dec28.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  }

  // Initialiseer week selectors
  // Startweek: 1 week vooraf, max 8 weken vooruit
  const startWeekTrigger = initWeekSelectTrigger(formHandler, {
    weekField: 'pauze_start_weeknr',
    infoField: 'pauze_start_weeknr',
    minWeeksAhead: 1, // 1 week vooraf
    maxWeeks: 9 // 1 week vooraf + 8 weken pauze = 9 weken totaal bereik
  });

  // Eindweek: zelfde bereik als startweek (gebruiker kiest binnen dit bereik)
  const eindWeekTrigger = initWeekSelectTrigger(formHandler, {
    weekField: 'pauze_eind_weeknr',
    infoField: 'pauze_eind_weeknr',
    minWeeksAhead: 1,
    maxWeeks: 9
  });

  // Haal input elementen op
  const startInput = formElement.querySelector('[data-field-name="pauze_start_weeknr"]');
  const eindInput = formElement.querySelector('[data-field-name="pauze_eind_weeknr"]');
  const eindInfoElement = formElement.querySelector('[data-field-info="pauze_eind_weeknr"]');

  // Prefill: Zet eindweek automatisch op startweek + 1 week
  if (startInput && eindInput) {
    const startWeek = parseInt(startInput.value, 10);
    const startYear = parseInt(startInput.dataset.weekYear, 10);
    
    if (!isNaN(startWeek) && !isNaN(startYear)) {
      const nextWeekData = getNextWeek(startWeek, startYear);
      eindInput.value = String(nextWeekData.week);
      eindInput.dataset.weekYear = String(nextWeekData.year);
      
      // Update info display
      if (eindInfoElement) {
        const startDate = getStartDateOfISOWeek(nextWeekData.week, nextWeekData.year);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        eindInfoElement.textContent = `Week ${nextWeekData.week} (${formatDate(startDate, nextWeekData.year)} – ${formatDate(endDate, nextWeekData.year)})`;
      }
      
      // Sync met formHandler
      if (formHandler.formData) {
        formHandler.formData['pauze_eind_weeknr'] = eindInput.value;
        if (formHandler.formState['pauze_eind_weeknr']) {
          formHandler.formState['pauze_eind_weeknr'].isTouched = true;
        }
      }
      eindInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Auto-update eindweek bij startweek wijziging
  if (startInput && eindInput) {
    startInput.addEventListener('input', () => {
      const startWeek = parseInt(startInput.value, 10);
      const startYear = parseInt(startInput.dataset.weekYear, 10);
      
      if (!isNaN(startWeek) && !isNaN(startYear)) {
        const nextWeekData = getNextWeek(startWeek, startYear);
        eindInput.value = String(nextWeekData.week);
        eindInput.dataset.weekYear = String(nextWeekData.year);
        
        // Update info display
        if (eindInfoElement) {
          const startDate = getStartDateOfISOWeek(nextWeekData.week, nextWeekData.year);
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          eindInfoElement.textContent = `Week ${nextWeekData.week} (${formatDate(startDate, nextWeekData.year)} – ${formatDate(endDate, nextWeekData.year)})`;
        }
        
        // Trigger change voor formHandler update
        eindInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Validatie trigger
    startInput.addEventListener('change', () => {
      if (eindInput.value) {
        eindInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  // Helper functies voor datum formatting
  function getStartDateOfISOWeek(week, year) {
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dayOfWeek = simple.getUTCDay() || 7;
    if (dayOfWeek > 4) {
      simple.setUTCDate(simple.getUTCDate() + 8 - dayOfWeek);
    } else {
      simple.setUTCDate(simple.getUTCDate() - (dayOfWeek - 1));
    }
    return simple;
  }

  function formatDate(date, year) {
    const displayYear = year || date.getUTCFullYear();
    return `${date.getUTCDate()} ${date.toLocaleString('nl-NL', { month: 'long', timeZone: 'UTC' })} ${displayYear}`;
  }

  console.log('✅ [Abonnement Pauze] Pauze formulier geïnitialiseerd');
}
