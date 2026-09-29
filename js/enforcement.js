// Where to go when the airline says no. Pure data plus two small functions.
// checked: '2026-09'

// EU261 national enforcement bodies (NEBs). Complain to the NEB of the country the flight left from,
// or, for flights into the EU from outside, the country it landed in (Commission guidelines C/2024/5687, 8.1).
// Source: European Commission list of NEBs for Regulation 261/2004, updated 27 August 2026.
// checked: '2026-09'
export const NEB_LIST_URL = 'https://transport.ec.europa.eu/transport-themes/passenger-rights/national-enforcement-bodies-neb_en';

export const EU_NEBS = {
  AT: { name: 'the Agentur für Passagier- und Fahrgastrechte (apf)', url: 'https://en.apf.gv.at/beschwerde-flug' },
  BE: { name: 'the FPS Mobility and Transport', url: 'https://servicerequest.mobilit.fgov.be/p/question/en/LV_PAXR' },
  BG: { name: 'the Civil Aviation Administration', url: 'https://www.caa.bg/en/category/282' },
  HR: { name: 'the Croatian Civil Aviation Agency', url: 'https://www.ccaa.hr/en/passenger-rights-26099' },
  CY: { name: 'the Department of Civil Aviation', url: NEB_LIST_URL },
  CZ: { name: 'the Civil Aviation Authority', url: 'https://kompenzace.caa.gov.cz/?lang=en' },
  DK: { name: 'the Danish Civil Aviation and Railway Authority', url: 'https://www.en.flypassager.dk/your-guide-to-filing-a-complaint-about-your-flight' },
  EE: { name: 'the Consumer Protection and Technical Regulatory Authority', url: 'https://ttja.ee/en/private-client/consumer-rights/trade-services/travel-services' },
  FI: { name: 'the Consumer Disputes Board', url: 'https://www.kuluttajariita.fi/en/' },
  FR: { name: 'the DGAC', url: 'https://droits-passagers-aeriens.aviation-civile.gouv.fr/public/signalement?new-signalement=true' },
  DE: { name: 'the Luftfahrt-Bundesamt (LBA)', url: 'https://www.lba.de/EN/AirPassengersRights/Complaint_Form/Complaint_Form_node.html' },
  GR: { name: 'the Hellenic Civil Aviation Authority', url: 'https://hcaa.gov.gr/en/Passenger-Rights' },
  HU: { name: 'the Budapest Government Office consumer protection department', url: NEB_LIST_URL },
  IE: { name: 'the Irish Aviation Authority', url: 'https://www.iaa.ie/consumer-protection/air-passenger-rights' },
  IT: { name: 'ENAC', url: 'https://carta-diritti.enac.gov.it/en' },
  LV: { name: 'the Consumer Rights Protection Centre', url: 'https://www.ptac.gov.lv/en/air-passenger-rights' },
  LT: { name: 'the Lithuanian Transport Safety Administration', url: 'https://ltsa.lrv.lt/en/sector-activities/civil-aviation/air-passenger-rights' },
  LU: { name: 'the Direction de la Protection des consommateurs', url: 'https://guichet.public.lu/en/citoyens/transport/droits-voyageurs/annulation-dommages-retard/droit-passagers-aeriens.html' },
  MT: { name: 'the Malta Competition and Consumer Affairs Authority', url: 'https://mccaa.org.mt/' },
  NL: { name: 'the Human Environment and Transport Inspectorate (ILT)', url: 'https://e-loket.ilent.nl/formulier/en-GB/DefaultEnvironment/MLu_005.aspx' },
  PL: { name: 'the Passengers’ Rights Ombudsman at the Civil Aviation Authority', url: 'https://pasazerlotniczy.ulc.gov.pl/en/submit-an-application/interactive-form' },
  PT: { name: 'ANAC', url: 'https://formdigital.anac.pt/?fid=607CA847-9BC7-41E0-9F59-03BC71F791CB' },
  RO: { name: 'the National Authority for Consumer Protection (ANPC)', url: 'https://anpc.ro/' },
  SK: { name: 'the Slovak Trade Inspection', url: 'https://www.soi.sk/sk/prava-cestujucich/prava-cestujucich-v-leteckej-doprave.soi' },
  SI: { name: 'the Civil Aviation Agency', url: 'https://www.caa.si/en/passenger-rights.html' },
  ES: { name: 'AESA', url: 'https://sede.seguridadaerea.gob.es/sede-aesa/areas-tematicas/derechos-de-los-pasajeros' },
  SE: { name: 'Konsumentverket', url: 'https://www.konsumentverket.se/' },
  IS: { name: 'the Icelandic Transport Authority', url: 'https://island.is/en/o/transport-authority/rights-of-air-passengers' },
  NO: { name: 'Transportklagenemnda', url: 'https://www.reiselivsforum.no/' },
  CH: { name: 'the Federal Office of Civil Aviation (FOCA)', url: 'https://www.bazl.admin.ch/pax-online-form' },
};

// French outermost regions fall under France's enforcement body.
const NEB_ALIAS = { GP: 'FR', GF: 'FR', MQ: 'FR', RE: 'FR', YT: 'FR', MF: 'FR', BL: 'FR' };

export const UK_ROUTES = {
  adr: [
    { label: 'AviationADR', url: 'https://www.aviationadr.org.uk/' },
    { label: 'CEDR', url: 'https://www.cedr-assist.com/' },
  ],
  adrInfo: 'https://www.caa.co.uk/air-passengers/travel-problems-and-rights/travel-complaints/alternative-dispute-resolution/',
  pact: 'https://www.caa.co.uk/air-passengers/travel-problems-and-rights/travel-complaints/how-the-caa-can-help/',
};

export const US_ROUTES = {
  complaint: 'https://airconsumer.dot.gov/consumer/s/oacp-form',
  info: 'https://www.transportation.gov/airconsumer/file-consumer-complaint',
};

export const CA_ROUTES = {
  complaint: 'https://formulaires-forms.otc-cta.gc.ca/en/air-travel-complaint',
  info: 'https://protection-passager-passenger.otc-cta.gc.ca/en/air-travel-complaints',
};

export const ESCP_URL = 'https://e-justice.europa.eu/42/EN/small_claims';

/** The EU enforcement body for this trip, or null. */
export function enforcerFor(v) {
  const r = v.route;
  const a = r.fromZone === 'EU' ? r.from : r.toZone === 'EU' ? r.to : null;
  if (!a) return null;
  const cc = NEB_ALIAS[a.country] || a.country;
  const neb = EU_NEBS[cc];
  return neb ? { ...neb, country: cc } : null;
}

/** Three steps: send it, escalate for free, then court as a last resort. */
export function escalationSteps(v) {
  const p = v.primary;
  if (!p) return [];
  const steps = [];
  if (p.id === 'eu261') {
    const neb = enforcerFor(v);
    steps.push({
      title: 'Send it and wait',
      body: [
        'Use the airline’s claim form if it has one and paste the letter in, or email customer relations. Save the confirmation.',
        'Give them the 14 days the letter sets. Many pay once they see you know the rules.',
      ],
    });
    steps.push({
      title: 'Complain to the enforcement body, free',
      body: [
        neb
          ? `For this flight that’s ${neb.name}. Attach your letter, the airline’s reply and your boarding pass.`
          : 'Every EU country has a national enforcement body. Use the one for the country your flight left from, or landed in if it came from outside the EU.',
        neb && neb.country === 'FR'
          ? 'In France, since 6 February 2026, you have to try the Médiateur Tourisme et Voyage before going to court, with some exceptions.'
          : 'Some countries also run a free dispute scheme for airline claims. The enforcement body will point you to it.',
      ],
      links: [
        ...(neb ? [{ label: `Complain to ${neb.name.replace(/^the /, '')}`, url: neb.url }] : []),
        { label: 'Commission list of enforcement bodies', url: NEB_LIST_URL },
      ],
    });
    steps.push({
      title: 'Small claims court',
      body: [
        'Claims up to €5,000 against an airline in another EU country can go through the European Small Claims Procedure, filled in on paper or online, usually without a lawyer.',
      ],
      links: [{ label: 'European Small Claims Procedure', url: ESCP_URL }],
    });
  } else if (p.id === 'uk261') {
    steps.push({
      title: 'Send it and wait',
      body: [
        'Use the airline’s claim form or email customer relations, and keep the confirmation.',
        'If they refuse, or say nothing for 8 weeks, you can escalate.',
      ],
    });
    steps.push({
      title: 'ADR scheme or the CAA, free',
      body: [
        'Most airlines flying in the UK belong to one of two approved ADR schemes, AviationADR or CEDR. The airline’s final reply has to say which. Apply within 12 months of that reply.',
        'If the airline isn’t in a scheme, the CAA’s Passenger Advice and Complaints Team can look at it.',
      ],
      links: [...UK_ROUTES.adr, { label: 'CAA complaints team', url: UK_ROUTES.pact }],
    });
    steps.push({
      title: 'Small claims court',
      body: [
        'In England and Wales you can claim online through Money Claim Online. Scotland and Northern Ireland have their own simple procedures.',
      ],
      links: [{ label: 'Make a court claim for money (GOV.UK)', url: 'https://www.gov.uk/make-court-claim-for-money' }],
    });
  } else if (p.id === 'appr') {
    steps.push({
      title: 'Send it in writing',
      body: [
        'Use the airline’s compensation form or email. The clock starts when they receive it: they have 30 days to pay or explain.',
        'You have one year from the flight to ask.',
      ],
    });
    steps.push({
      title: 'Complain to the CTA, free',
      body: [
        'If the airline hasn’t fixed it within 30 days of your written request, file with the Canadian Transportation Agency. Attach your request and their answer.',
        'The Agency warns that reviews can take a long time, sometimes more than two years.',
      ],
      links: [
        { label: 'CTA complaint form', url: CA_ROUTES.complaint },
        { label: 'How CTA complaints work', url: CA_ROUTES.info },
      ],
    });
    steps.push({
      title: 'Small claims court',
      body: ['Every province runs a small claims court for amounts like this. You don’t need a lawyer.'],
    });
  } else if (p.id === 'us') {
    steps.push({
      title: 'Ask in writing',
      body: ['Email the airline or use its refund or complaint form, and keep a copy.'],
    });
    steps.push({
      title: 'Complain to the DOT, free',
      body: [
        'The Department of Transportation forwards every complaint to the airline, which has to answer. Complaints also go into DOT’s monthly airline reports.',
      ],
      links: [
        { label: 'DOT complaint form', url: US_ROUTES.complaint },
        { label: 'About DOT complaints', url: US_ROUTES.info },
      ],
    });
    steps.push({
      title: 'Dispute the charge or go to small claims',
      body: [
        'For a refund you’re owed, your card issuer can reverse the charge. For bump pay, small claims court is the usual route.',
      ],
    });
  }
  return steps;
}
