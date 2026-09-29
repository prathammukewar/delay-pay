// Geography helpers: great-circle distance and which passenger-rights zone an airport sits in.
// Pure functions, no DOM.

const EARTH_RADIUS_KM = 6371.0088; // IUGG mean Earth radius

// EU 27 member states.
export const EU27 = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

// EEA states outside the EU plus Switzerland apply Regulation 261/2004 too.
export const EEA_CH = new Set(['IS', 'LI', 'NO', 'CH']);

// Outermost regions are part of the EU. OurAirports files the French ones under their own codes.
// The Canary Islands, Madeira and the Azores sit under ES and PT, so they are covered already.
// Saint Barthelemy (BL) is included because the Commission's 2024 interpretative guidelines (C/2024/5687,
// section 2.1.1) and the Your Europe page both list it. Faroe Islands, Greenland and the overseas
// countries and territories in Annex II TFEU count as non-EU countries.
export const EU_OUTERMOST = new Set(['GP', 'GF', 'MQ', 'RE', 'YT', 'MF', 'BL']);

// Airports on territory where EU law does not apply even though the country code says EU.
// Ercan is in the north of Cyprus, where the acquis is suspended (Protocol 10 to the 2003 Act of Accession).
export const EU_EXCLUDED_AIRPORTS = new Set(['ECN']);

// US territories count as the United States for DOT rules.
export const US_TERRITORIES = new Set(['PR', 'VI', 'GU', 'AS', 'MP']);

/**
 * Which rules zone an airport belongs to.
 * @returns {'EU'|'UK'|'US'|'CA'|'OTHER'}
 */
export function zoneOf(airport) {
  if (!airport) return 'OTHER';
  const cc = airport.country;
  if (EU_EXCLUDED_AIRPORTS.has(airport.code)) return 'OTHER';
  if (EU27.has(cc) || EEA_CH.has(cc) || EU_OUTERMOST.has(cc)) return 'EU';
  if (cc === 'GB') return 'UK';
  if (cc === 'US' || US_TERRITORIES.has(cc)) return 'US';
  if (cc === 'CA') return 'CA';
  return 'OTHER';
}

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
