import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Official UNCTAD country names (DimCountries_TargetEconomies_Classification),
 * https://unctadstat.unctad.org/EN/Classifications/DimCountries_TargetEconomies_Classification.xls
 * – re-downloads periodically drift (new/renamed economies), so this is a
 * snapshot in `data/UN_Country_Names.csv`, not fetched live.
 */
export function loadOfficialCountryNames() {
  const csvPath = path.join(__dirname, '..', 'data', 'UN_Country_Names.csv');
  const records = parse(fs.readFileSync(csvPath, 'utf8'), { columns: true, skip_empty_lines: true });
  return records.map((r) => ({ code: r.Code, name: r['Official UNCTAD name'] }));
}

/**
 * Standing exceptions where the project prefers common usage over the
 * official UNCTAD label – confirmed with the user 2026-10-06: "United
 * States" rather than "United States of America". Add further confirmed
 * exceptions here as the user approves them; don't invent new ones.
 */
export const COUNTRY_NAME_EXCEPTIONS = new Set(['United States']);

/**
 * A short list of informal/common names actually seen in source charts,
 * mapped to their official UNCTAD equivalent – not exhaustive (the full
 * canonical list is `loadOfficialCountryNames()`), just the ones that
 * come up often enough to hardcode as a fast first check before a manual
 * lookup against the full list.
 */
export const COMMON_INFORMAL_TO_OFFICIAL = {
  'United States of America': 'United States', // the one standing exception
  USA: 'United States',
  US: 'United States',
  UK: 'United Kingdom',
  Russia: 'Russian Federation',
  Turkey: 'Türkiye',
  Vietnam: 'Viet Nam',
  Laos: "Lao People's Dem. Rep.",
  'South Korea': 'Republic of Korea',
  'North Korea': "Dem. People's Rep. of Korea",
  Bolivia: 'Bolivia (Plurinational State of)',
  Venezuela: 'Venezuela (Bolivarian Rep. of)',
  Iran: 'Iran (Islamic Republic of)',
  Moldova: 'Republic of Moldova',
  Tanzania: 'United Republic of Tanzania',
  'Czech Republic': 'Czechia',
  'Cape Verde': 'Cabo Verde',
  Swaziland: 'Eswatini',
  Macedonia: 'North Macedonia',
  'Ivory Coast': "Côte d'Ivoire",
  Brunei: 'Brunei Darussalam',
  'DR Congo': 'Dem. Rep. of the Congo',
  'Democratic Republic of the Congo': 'Dem. Rep. of the Congo',
  'Congo-Brazzaville': 'Congo',
  Syria: 'Syrian Arab Republic',
  Micronesia: 'Micronesia (Federated States of)',
};
