/**
 * RxNorm API Service
 * Provides methods to search and retrieve drug information from the RxNorm database
 */

import {
  RxNormApproximateTermResponse,
  RxNormAllPropertiesResponse,
  RxNormNDCsResponse,
  DrugSearchResult,
  RxNormSearchOptions,
  RxNormServiceError,
  RxNormCandidate,
} from '../types/rxnorm';

const RXNORM_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_TIMEOUT = 10000; // 10 seconds

/**
 * Search for drugs by approximate term (fuzzy matching)
 * @param searchTerm - The drug name or partial name to search for
 * @param options - Search options (maxResults, timeout)
 * @returns Array of drug search results with NDC information
 */
export async function searchDrugsByTerm(
  searchTerm: string,
  options: RxNormSearchOptions = {}
): Promise<DrugSearchResult[]> {
  const { maxResults = DEFAULT_MAX_RESULTS, timeout = DEFAULT_TIMEOUT } = options;

  if (!searchTerm || searchTerm.trim().length < 3) {
    throw createServiceError(
      'PARSE_ERROR',
      'Search term must be at least 3 characters long'
    );
  }

  try {
    // Step 1: Find RXCUIs by approximate term
    const candidates = await fetchApproximateTermCandidates(searchTerm, timeout);

    if (!candidates || candidates.length === 0) {
      return [];
    }

    // Step 2: Get detailed information for each candidate
    const results: DrugSearchResult[] = [];
    const candidatesToProcess = candidates.slice(0, maxResults);

    for (const candidate of candidatesToProcess) {
      try {
        const drugInfo = await fetchDrugDetails(candidate, timeout);
        if (drugInfo) {
          results.push(drugInfo);
        }
      } catch (error) {
        console.error(`Failed to fetch details for RXCUI ${candidate.rxcui}:`, error);
        // Continue processing other candidates
      }
    }

    return results;
  } catch (error) {
    if (isServiceError(error)) {
      throw error;
    }
    throw createServiceError('API_ERROR', 'Failed to search drugs', error);
  }
}

/**
 * Fetch approximate term candidates from RxNorm
 */
async function fetchApproximateTermCandidates(
  searchTerm: string,
  timeout: number
): Promise<RxNormCandidate[]> {
  const url = `${RXNORM_BASE_URL}/approximateTerm.json?term=${encodeURIComponent(
    searchTerm
  )}&maxEntries=10`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw createServiceError(
        'API_ERROR',
        `RxNorm API returned ${response.status}: ${response.statusText}`
      );
    }

    const data: RxNormApproximateTermResponse = await response.json();

    if (!data.approximateGroup?.candidate) {
      return [];
    }

    // Normalize to array
    const candidates = Array.isArray(data.approximateGroup.candidate)
      ? data.approximateGroup.candidate
      : [data.approximateGroup.candidate];

    return candidates;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw createServiceError('NETWORK_ERROR', 'Request timeout');
    }

    throw error;
  }
}

/**
 * Fetch detailed drug information including properties and NDCs
 */
async function fetchDrugDetails(
  candidate: RxNormCandidate,
  timeout: number
): Promise<DrugSearchResult | null> {
  const rxcui = candidate.rxcui;

  // Fetch properties and NDCs in parallel
  const [properties, ndcs] = await Promise.all([
    fetchDrugProperties(rxcui, timeout),
    fetchDrugNDCs(rxcui, timeout),
  ]);

  // Must have at least one NDC to be useful
  if (!ndcs || ndcs.length === 0) {
    return null;
  }

  // Map properties to drug information
  const drugInfo = mapPropertiesToDrugInfo(candidate, properties, ndcs);
  return drugInfo;
}

/**
 * Fetch all properties for a given RXCUI
 */
async function fetchDrugProperties(
  rxcui: string,
  timeout: number
): Promise<Map<string, string>> {
  const url = `${RXNORM_BASE_URL}/rxcui/${rxcui}/allProperties.json?prop=all`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw createServiceError(
        'API_ERROR',
        `Failed to fetch properties for RXCUI ${rxcui}`
      );
    }

    const data: RxNormAllPropertiesResponse = await response.json();

    const propertyMap = new Map<string, string>();

    if (data.propConceptGroup?.propConcept) {
      for (const prop of data.propConceptGroup.propConcept) {
        propertyMap.set(prop.propName, prop.propValue);
      }
    }

    return propertyMap;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw createServiceError('NETWORK_ERROR', 'Request timeout');
    }

    throw error;
  }
}

/**
 * Fetch NDC codes for a given RXCUI
 */
async function fetchDrugNDCs(rxcui: string, timeout: number): Promise<string[]> {
  const url = `${RXNORM_BASE_URL}/rxcui/${rxcui}/ndcs.json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw createServiceError('API_ERROR', `Failed to fetch NDCs for RXCUI ${rxcui}`);
    }

    const data: RxNormNDCsResponse = await response.json();

    return data.ndcGroup?.ndcList?.ndc || [];
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw createServiceError('NETWORK_ERROR', 'Request timeout');
    }

    throw error;
  }
}

/**
 * Map RxNorm properties to domain DrugSearchResult
 */
function mapPropertiesToDrugInfo(
  candidate: RxNormCandidate,
  properties: Map<string, string>,
  ndcs: string[]
): DrugSearchResult {
  const medicationName =
    properties.get('RxNorm Name') || properties.get('Display Name') || candidate.name;
  const strengthRaw = properties.get('Strength') || '';
  const doseForm = properties.get('Dose Form') || 'Tablet';

  // Parse strength (e.g., "10 mg" -> strength: 10, unit: "mg")
  const { strength, unit } = parseStrength(strengthRaw);

  // Extract generic name (first word of medication name)
  const genericName = extractGenericName(medicationName);

  return {
    rxcui: candidate.rxcui,
    medicationName,
    genericName,
    strength,
    strengthUnit: unit,
    form: doseForm,
    ndcId: ndcs[0], // Primary NDC
    allNDCs: ndcs,
    displayText: `${medicationName} - NDC: ${ndcs[0]}`,
  };
}

/**
 * Parse strength string into number and unit
 * Examples:
 *   "10 mg" -> { strength: 10, unit: "mg" }
 *   "0.5 mL" -> { strength: 0.5, unit: "mL" }
 *   "100 UNT/ML" -> { strength: 100, unit: "UNT/ML" }
 *   "100" -> { strength: 100, unit: "mg" }
 */
export function parseStrength(strengthStr: string): { strength: number; unit: string } {
  if (!strengthStr || strengthStr.trim() === '') {
    return { strength: 0, unit: 'mg' };
  }

  // Match pattern: number (with optional decimal) followed by optional whitespace and unit (including /)
  const match = strengthStr.match(/(\d+\.?\d*)\s*([\w\/]+)?/);

  if (match) {
    const strength = parseFloat(match[1]);
    const unit = match[2] || 'mg'; // Default to mg if no unit specified
    return { strength, unit };
  }

  return { strength: 0, unit: 'mg' };
}

/**
 * Extract generic name from medication name
 * Takes the first word/token before space or special character
 */
export function extractGenericName(medicationName: string): string {
  if (!medicationName) return '';

  // Trim whitespace first
  const trimmed = medicationName.trim();
  if (!trimmed) return '';

  // Split on space, comma, dash, slash, or parenthesis
  const tokens = trimmed.split(/[\s,\-\/\(]/);
  return tokens[0] || trimmed;
}

/**
 * Create a typed service error
 */
function createServiceError(
  type: RxNormServiceError['type'],
  message: string,
  originalError?: unknown
): RxNormServiceError {
  return {
    type,
    message,
    originalError,
  };
}

/**
 * Type guard to check if error is a service error
 */
function isServiceError(error: unknown): error is RxNormServiceError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error
  );
}

// Export for testing
export const __testing__ = {
  fetchApproximateTermCandidates,
  fetchDrugDetails,
  fetchDrugProperties,
  fetchDrugNDCs,
  mapPropertiesToDrugInfo,
  createServiceError,
  isServiceError,
};

