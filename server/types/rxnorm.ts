/**
 * RxNorm API Response Types
 * Based on https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
 */

// ApproximateTerm API Response
export interface RxNormApproximateTermResponse {
  approximateGroup?: {
    candidate?: RxNormCandidate[] | RxNormCandidate;
  };
}

export interface RxNormCandidate {
  rxcui: string;
  name: string;
  score?: string;
  rank?: string;
}

// AllProperties API Response
export interface RxNormAllPropertiesResponse {
  propConceptGroup?: {
    propConcept?: RxNormProperty[];
  };
}

export interface RxNormProperty {
  propCategory?: string;
  propName: string;
  propValue: string;
}

// NDCs API Response
export interface RxNormNDCsResponse {
  ndcGroup?: {
    ndcList?: {
      ndc?: string[];
    };
  };
}

// Domain Types for Application Use
export interface DrugSearchResult {
  rxcui: string;
  medicationName: string;
  genericName: string;
  strength: number;
  strengthUnit: string;
  form: string;
  ndcId: string;
  allNDCs: string[];
  displayText: string;
}

export interface RxNormSearchOptions {
  maxResults?: number;
  timeout?: number;
}

export interface RxNormServiceError {
  type: 'NOT_FOUND' | 'API_ERROR' | 'PARSE_ERROR' | 'NETWORK_ERROR';
  message: string;
  originalError?: unknown;
}

