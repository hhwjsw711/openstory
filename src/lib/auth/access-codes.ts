/**
 * Hard-coded list of valid access codes for signup
 * Add new codes here as needed
 */
export const VALID_ACCESS_CODES = [
  'GODFATHER-VITO-5836',
  'STAR-WARS-2749',
  'MATRIX-NEO-8142',
  'INCEPTION-DREAM-3965',
  'PULP-FICTION-7284',
  'DARK-KNIGHT-4927',
  'FIGHT-CLUB-6153',
  'FORREST-GUMP-9478',
  'JURASSIC-PARK-3721',
  'TITANIC-JACK-8594',
  'AVATAR-PANDORA-2067',
  'AVENGERS-ASSEMBLE-7315',
  'BACK-FUTURE-4682',
  'JAWS-SHARK-9236',
  'EXTRA-TERRESTRIAL-5814',
  'SHAWSHANK-REDEMPTION-6729',
  'LION-KING-3458',
  'TOY-STORY-8126',
  'GLADIATOR-MAXIMUS-4973',
  'INTERSTELLAR-COOPER-7691',
  'HARRY-SALLY-3947',
  'PRETTY-WOMAN-8251',
  'NOTTING-HILL-6382',
  'SLEEPLESS-SEATTLE-4719',
  'YOUVE-GOT-MAIL-9163',
  'TEN-THINGS-5824',
  'BRIDGET-JONES-7491',
  'PROPOSAL-SANDRA-2856',
  'CRAZY-STUPID-LOVE-1673',
  'DRESSES-TWENTYSEVEN-4298',
  'BEST-FRIEND-WEDDING-8534',
  'HOLIDAY-COTTAGE-9287',
  'LOVE-ACTUALLY-5612',
  'FIVE-HUNDRED-DAYS-3078',
  'LOSE-GUY-TENDAYS-7945',
  'CLUELESS-CHER-2461',
  'FOUR-WEDDINGS-6139',
  'SOMETHING-MARY-8704',
  'WHILE-SLEEPING-3526',
  'PRINCESS-BRIDE-4985',
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
