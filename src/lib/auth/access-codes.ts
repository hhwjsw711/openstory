/**
 * Hard-coded list of valid access codes for signup
 * Add new codes here as needed
 */
export const VALID_ACCESS_CODES = [
  // Tom's fave's
  'DARK-KNIGHT-4927',
  'INTERSTELLAR-7691',
  'JURASSIC-PARK-3721',
  // Recent Best Picture winners & nominees
  'EVERYTHING-EVERYWHERE-2847',
  'PARASITE-STAIRS-6293',
  'OPPENHEIMER-TRINITY-8154',
  'POOR-THINGS-BELLA-3968',
  // Modern indie classics
  'WHIPLASH-TEMPO-7421',
  'MOONLIGHT-CHIRON-5836',
  'LADY-BIRD-SACRAMENTO-9142',
  'UNCUT-GEMS-OPAL-4765',
  'HEREDITARY-PAIMON-8239',
  'THE-LIGHTHOUSE-MERMAID-6584',
  'THE-WITCH-THOMASIN-3917',
  'MIDSOMMAR-SOLSTICE-7268',
  // A24 hits
  'GET-OUT-SUNKEN-5492',
  'EX-MACHINA-AVA-8731',
  'THE-NORTHMAN-AMLETH-4186',
  'AFTERSUN-CALUM-9573',
  // Visually stunning & acclaimed
  'BLADE-RUNNER-2049-4628',
  'MAD-MAX-FURY-3854',
  'DUNE-ARRAKIS-7912',
  'ARRIVAL-HEPTAPOD-2376',
  'SHAPE-WATER-ELISA-6549',
  'GRAND-BUDAPEST-GUSTAVE-8195',
  'SPIDER-VERSE-MILES-4762',
  // Modern thrillers & genre
  'KNIVES-OUT-BLANC-5318',
  'QUIET-PLACE-SILENCE-9827',
  'PRISONERS-DOVER-6143',
  'SICARIO-JUAREZ-3584',
  'DRIVE-DRIVER-7269',
  'JOKER-ARTHUR-4951',
  'THE-BATMAN-VENGEANCE-8436',
  // Auteur films
  'THERE-WILL-BLOOD-8672',
  'NO-COUNTRY-CHIGURH-5194',
  'BIRDMAN-RIGGAN-3728',
  'THE-SOCIAL-NETWORK-9461',
  'BABY-DRIVER-GETAWAY-6835',
  'ONCE-HOLLYWOOD-CLIFF-2947',
  // War & historical
  'NINETEEN-SEVENTEEN-4583',
  'DUNKIRK-MOLE-7912',
  'THE-REVENANT-GLASS-3186',
  // Recent blockbusters
  'TOP-GUN-MAVERICK-5724',
  'THE-FABELMANS-SAMMY-8392',
] as const;

/**
 * Validates if a given code is in the list of valid access codes
 * Case-insensitive and trims whitespace
 */
export function isValidAccessCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  const normalizedCode = code.toUpperCase().trim();
  return VALID_ACCESS_CODES.includes(
    normalizedCode as (typeof VALID_ACCESS_CODES)[number]
  );
}
