// public/forms/schemas/formSchemas.js

import { commonFields } from './commonFields.js';

/**
 * Database van form schemas.
 * Elk schema beschrijft:
 *  - name: unieke naam
 *  - selector: CSS-selector van het form-element
 *  - fields: definitie van elk veld incl. sanitizers, validators en messages
 *  - submit (optioneel): API-configuratie en callbacks
 *  - triggers (optioneel): globale triggers op veld-combinaties
 */
export function getFormSchema(name) {
  const schemas = {
    'postcode-form': {
      name: 'postcode-form',
      selector: '#postcode-form',
      fields: {
        postcode: commonFields.postcode,
        huisnummer: commonFields.huisnummer,
        toevoeging: commonFields.toevoeging,
      },
      submit: {
        endpoint: '/api/submit-postcode',
        method: 'POST',
        onSuccess: () => { alert('Adres succesvol opgeslagen!'); },
      },
      // Geen triggers in dit formulier; simpel postcodeschema
    },

    // Voorbeeld ander formulier met multi-veld trigger:
    // 'address-lookup': {
    //   name: 'address-lookup',
    //   selector: '#address-lookup-form',
    //   fields: {
    //     postcode: commonFields.postcode,
    //     huisnummer: commonFields.huisnummer,
    //     toevoeging: commonFields.toevoeging,
    //   },
    //   triggers: [
    //     {
    //       when: 'fieldsValid',
    //       fields: ['postcode', 'huisnummer'],
    //       action: async (data, update) => {
    //         // voorbeeld action: fetch address
    //         const res = await fetch(`/api/address?postcode=${data.postcode}&huisnummer=${data.huisnummer}`);
    //         if (res.ok) {
    //           const json = await res.json();
    //           update({ straat: json.street, plaats: json.city });
    //         }
    //       },
    //     },
    //   ],
    //   submit: {
    //     endpoint: '/api/submit-address-lookup',
    //     method: 'POST',
    //     onSuccess: () => { /* success */ },
    //   },
    // },
  };

  return schemas[name] || null;
}
