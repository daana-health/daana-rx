import { parseSmartSearch, getExampleQueries, getSearchSuggestions } from '../smartSearch';

describe('Smart Search Parser', () => {
  describe('parseSmartSearch', () => {
    it('should parse medication names', () => {
      const result = parseSmartSearch('lisinopril');
      expect(result.filters.medicationName).toBe('lisinopril');
    });

    it('should parse expiration windows', () => {
      const testCases = [
        { query: 'expired', expected: 'EXPIRED' },
        { query: 'expiring next week', expected: 'EXPIRING_7_DAYS' },
        { query: 'expiring in 30 days', expected: 'EXPIRING_30_DAYS' },
        { query: 'expires in 60 days', expected: 'EXPIRING_60_DAYS' },
        { query: 'expiring in 90 days', expected: 'EXPIRING_90_DAYS' },
      ];

      testCases.forEach(({ query, expected }) => {
        const result = parseSmartSearch(query);
        expect(result.filters.expirationWindow).toBe(expected);
      });
    });

    it('should parse NDC codes', () => {
      const testCases = [
        'ndc:0093-7214-01',
        'ndc 12345',
        'NDC: 0093-7214-01',
      ];

      testCases.forEach((query) => {
        const result = parseSmartSearch(query);
        expect(result.filters.ndcId).toBeDefined();
      });
    });

    it('should parse strength values', () => {
      const testCases = [
        { query: '10mg', min: 10, max: 10 },
        { query: '5 mg', min: 5, max: 5 },
        { query: 'strength: 100', min: 100, max: 100 },
      ];

      testCases.forEach(({ query, min, max }) => {
        const result = parseSmartSearch(query);
        expect(result.filters.minStrength).toBe(min);
        expect(result.filters.maxStrength).toBe(max);
      });
    });

    it('should parse strength ranges', () => {
      const testCases = [
        { query: '5-20mg', min: 5, max: 20 },
        { query: '10 to 50mg', min: 10, max: 50 },
        { query: 'strength 10-30', min: 10, max: 30 },
      ];

      testCases.forEach(({ query, min, max }) => {
        const result = parseSmartSearch(query);
        expect(result.filters.minStrength).toBe(min);
        expect(result.filters.maxStrength).toBe(max);
      });
    });

    it('should parse sorting preferences', () => {
      const testCases = [
        { query: 'sort by expiry', sortBy: 'EXPIRY_DATE' },
        { query: 'sort by name', sortBy: 'MEDICATION_NAME' },
        { query: 'sort by quantity', sortBy: 'QUANTITY' },
        { query: 'sort by strength', sortBy: 'STRENGTH' },
      ];

      testCases.forEach(({ query, sortBy }) => {
        const result = parseSmartSearch(query);
        expect(result.filters.sortBy).toBe(sortBy);
      });
    });

    it('should parse sort order', () => {
      const ascQueries = ['ascending', 'asc', 'oldest first'];
      ascQueries.forEach((query) => {
        const result = parseSmartSearch(query);
        expect(result.filters.sortOrder).toBe('ASC');
      });

      const descQueries = ['descending', 'desc', 'newest first'];
      descQueries.forEach((query) => {
        const result = parseSmartSearch(query);
        expect(result.filters.sortOrder).toBe('DESC');
      });
    });

    it('should handle complex combined queries', () => {
      const result = parseSmartSearch('lisinopril 10mg expiring next week');
      
      expect(result.filters.medicationName).toBe('lisinopril');
      expect(result.filters.minStrength).toBe(10);
      expect(result.filters.maxStrength).toBe(10);
      expect(result.filters.expirationWindow).toBe('EXPIRING_7_DAYS');
    });

    it('should handle empty or invalid queries gracefully', () => {
      const testCases = ['', '   ', null, undefined];
      
      testCases.forEach((query) => {
        const result = parseSmartSearch(query as any);
        expect(result.filters).toEqual({});
      });
    });

    it('should extract medication name after removing patterns', () => {
      const result = parseSmartSearch('metformin expiring in 30 days');
      
      expect(result.filters.medicationName).toBe('metformin');
      expect(result.filters.expirationWindow).toBe('EXPIRING_30_DAYS');
    });

    it('should handle location keywords in search terms', () => {
      const testCases = [
        'at fridge',
        'location: fridge',
        'in room temp',
      ];

      testCases.forEach((query) => {
        const result = parseSmartSearch(query);
        expect(result.searchTerms.length).toBeGreaterThan(0);
      });
    });

    it('should handle form types in search terms', () => {
      const testCases = [
        'tablets',
        'capsules',
        'liquid medications',
      ];

      testCases.forEach((query) => {
        const result = parseSmartSearch(query);
        expect(result.searchTerms.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return expiration suggestions for "exp" prefix', () => {
      const suggestions = getSearchSuggestions('exp');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('expir'))).toBe(true);
    });

    it('should return strength suggestions for numeric prefix', () => {
      const suggestions = getSearchSuggestions('10m');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('mg'))).toBe(true);
    });

    it('should return location suggestions for "loc" prefix', () => {
      const suggestions = getSearchSuggestions('loc');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('location'))).toBe(true);
    });

    it('should return NDC suggestions for "ndc" prefix', () => {
      const suggestions = getSearchSuggestions('ndc');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('ndc'))).toBe(true);
    });

    it('should return sort suggestions for "sort" prefix', () => {
      const suggestions = getSearchSuggestions('sort');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('sort'))).toBe(true);
    });
  });

  describe('getExampleQueries', () => {
    it('should return a list of example queries', () => {
      const examples = getExampleQueries();
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeGreaterThan(0);
    });

    it('should return diverse examples covering different features', () => {
      const examples = getExampleQueries();
      
      // Should have medication search examples
      expect(examples.some(e => /lisinopril|metformin/i.test(e))).toBe(true);
      
      // Should have expiration examples
      expect(examples.some(e => /expir/i.test(e))).toBe(true);
      
      // Should have strength examples
      expect(examples.some(e => /\d+mg/i.test(e))).toBe(true);
      
      // Should have NDC examples
      expect(examples.some(e => /ndc/i.test(e))).toBe(true);
    });
  });

  describe('Real-world use cases', () => {
    it('should handle typical daily inventory check query', () => {
      const result = parseSmartSearch('expiring next week sort by expiry');
      
      expect(result.filters.expirationWindow).toBe('EXPIRING_7_DAYS');
      expect(result.filters.sortBy).toBe('EXPIRY_DATE');
    });

    it('should handle specific medication lookup with strength', () => {
      const result = parseSmartSearch('metformin 500mg');
      
      expect(result.filters.medicationName).toBe('metformin');
      expect(result.filters.minStrength).toBe(500);
      expect(result.filters.maxStrength).toBe(500);
    });

    it('should handle compliance report query', () => {
      const result = parseSmartSearch('expired medications sort by name');
      
      expect(result.filters.expirationWindow).toBe('EXPIRED');
      expect(result.filters.sortBy).toBe('MEDICATION_NAME');
    });

    it('should handle location-specific inventory check', () => {
      const result = parseSmartSearch('tablets at fridge expiring in 30 days');
      
      expect(result.filters.expirationWindow).toBe('EXPIRING_30_DAYS');
      expect(result.searchTerms.some(term => term.includes('fridge'))).toBe(true);
      expect(result.searchTerms.some(term => term.includes('tablet'))).toBe(true);
    });

    it('should handle strength range analysis', () => {
      const result = parseSmartSearch('medications 10-50mg sort by strength ascending');
      
      expect(result.filters.minStrength).toBe(10);
      expect(result.filters.maxStrength).toBe(50);
      expect(result.filters.sortBy).toBe('STRENGTH');
      expect(result.filters.sortOrder).toBe('ASC');
    });
  });
});

