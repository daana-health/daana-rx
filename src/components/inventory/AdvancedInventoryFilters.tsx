'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, gql } from '@apollo/client';
import { Calendar as CalendarIcon, X, Filter, Download, Search, Sparkles, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  InventoryFiltersState,
  ExpirationWindow,
  UnitSortField,
  SortOrder,
  EXPIRATION_WINDOWS,
  SORT_FIELDS,
} from '@/types/inventory';
import { GetLocationsResponse } from '@/types/graphql';
import { parseSmartSearch, getExampleQueries } from '@/utils/smartSearch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RelatedMedications } from './RelatedMedications';

const GET_LOCATIONS = gql`
  query GetLocations {
    getLocations {
      locationId
      name
      temp
    }
  }
`;

interface AdvancedInventoryFiltersProps {
  filters: InventoryFiltersState;
  onFiltersChange: (filters: InventoryFiltersState) => void;
  onExport?: () => void;
}

export function AdvancedInventoryFilters({
  filters,
  onFiltersChange,
  onExport,
}: AdvancedInventoryFiltersProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [strengthRange, setStrengthRange] = useState<[number, number]>([0, 1000]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showExamples, setShowExamples] = useState<boolean>(false);

  const { data: locationsData } = useQuery<GetLocationsResponse>(GET_LOCATIONS);

  // Handle smart search with debounce
  const handleSmartSearch = useCallback((query: string) => {
    if (!query.trim()) {
      // If search is cleared, don't reset all filters, just clear search-related ones
      return;
    }

    const { filters: parsedFilters } = parseSmartSearch(query);
    
    // If we have location keywords, match them against actual locations
    if (locationsData?.getLocations && parsedFilters.medicationName) {
      const locationKeywordMatch = query.toLowerCase().match(/location[:\s]+(fridge|room temp)/i);
      if (locationKeywordMatch) {
        const keyword = locationKeywordMatch[1].toLowerCase();
        const matchedLocation = locationsData.getLocations.find(
          (loc) => loc.temp.toLowerCase().includes(keyword) || loc.name.toLowerCase().includes(keyword)
        );
        if (matchedLocation) {
          parsedFilters.locationIds = [matchedLocation.locationId];
        }
      }
    }
    
    // Merge with existing filters (don't overwrite everything)
    onFiltersChange({ ...filters, ...parsedFilters });
  }, [locationsData, filters, onFiltersChange]);

  // Debounce the search
  useEffect(() => {
    if (!searchQuery) return;
    
    const timeoutId = setTimeout(() => {
      handleSmartSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSmartSearch]);

  // Strongly typed update filter handlers
  const updateFilter = <K extends keyof InventoryFiltersState>(
    key: K,
    value: InventoryFiltersState[K]
  ): void => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const updateExpirationWindow = (value: ExpirationWindow | undefined): void => {
    updateFilter('expirationWindow', value);
  };

  const updateSortBy = (value: UnitSortField | undefined): void => {
    updateFilter('sortBy', value);
  };

  const updateSortOrder = (value: SortOrder | undefined): void => {
    updateFilter('sortOrder', value);
  };

  // Clear all filters
  const clearFilters = (): void => {
    onFiltersChange({});
    setStrengthRange([0, 1000]);
  };

  // Count active filters - properly typed
  const activeFilterCount: number = Object.keys(filters).filter((key) => {
    const filterKey = key as keyof InventoryFiltersState;
    const value = filters[filterKey];
    return (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    );
  }).length;

  // Apply strength range filter - properly typed
  const applyStrengthFilter = (): void => {
    updateFilter('minStrength', strengthRange[0]);
    updateFilter('maxStrength', strengthRange[1]);
  };

  return (
    <div className="space-y-4">
      {/* Smart Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            Intelligent Search
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowExamples(!showExamples)}
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm">
                <p className="font-medium mb-2">Try natural language queries:</p>
                <ul className="text-xs space-y-1">
                  {getExampleQueries().slice(0, 5).map((example, i) => (
                    <li key={i}>• {example}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder='Try "lisinopril expiring next week" or "10mg at fridge"...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => {
                setSearchQuery('');
                clearFilters();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Example queries */}
        {showExamples && (
          <Card className="p-3 bg-muted/50">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Example queries:</p>
            <div className="flex flex-wrap gap-2">
              {getExampleQueries().map((example, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setSearchQuery(example);
                    setShowExamples(false);
                  }}
                >
                  {example}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <h3 className="text-sm font-medium w-full mb-1">Quick Filters:</h3>
        {EXPIRATION_WINDOWS.map((window) => (
          <Button
            key={window.value}
            variant={filters.expirationWindow === window.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateExpirationWindow(window.value)}
            className="gap-2"
          >
            {window.label}
          </Button>
        ))}
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">{activeFilterCount} filter(s) active:</span>
          {filters.expirationWindow && filters.expirationWindow !== 'ALL' && (
            <Badge variant="secondary" className="gap-1">
              {EXPIRATION_WINDOWS.find(w => w.value === filters.expirationWindow)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter('expirationWindow', undefined)}
              />
            </Badge>
          )}
          {filters.medicationName && (
            <Badge variant="secondary" className="gap-1">
              Medication: {filters.medicationName}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter('medicationName', undefined)}
              />
            </Badge>
          )}
          {filters.locationIds && filters.locationIds.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              {filters.locationIds.length} Location(s)
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => updateFilter('locationIds', undefined)}
              />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear All
          </Button>
        </div>
      )}

      {/* Advanced Filters Collapsible */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Advanced Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">{activeFilterCount}</Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          {onExport && (
            <Button variant="outline" onClick={onExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>

        <CollapsibleContent className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filter Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !filters.expiryDateFrom && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.expiryDateFrom ? format(filters.expiryDateFrom, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.expiryDateFrom}
                        onSelect={(date) => updateFilter('expiryDateFrom', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Expiry To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !filters.expiryDateTo && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.expiryDateTo ? format(filters.expiryDateTo, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.expiryDateTo}
                        onSelect={(date) => updateFilter('expiryDateTo', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Medication Search */}
              <div className="space-y-2">
                <Label>Medication Name</Label>
                <Input
                  placeholder="Search by medication name..."
                  value={filters.medicationName || ''}
                  onChange={(e) => updateFilter('medicationName', e.target.value)}
                />
              </div>

              {/* Related Medications Feature */}
              {filters.medicationName && filters.medicationName.length >= 2 && (
                <RelatedMedications
                  drugName={filters.medicationName}
                  onSelectMedication={(medName) => {
                    updateFilter('medicationName', medName);
                    setSearchQuery(medName);
                  }}
                />
              )}

              <div className="space-y-2">
                <Label>Generic Name</Label>
                <Input
                  placeholder="Search by generic name..."
                  value={filters.genericName || ''}
                  onChange={(e) => updateFilter('genericName', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>NDC ID</Label>
                <Input
                  placeholder="Enter NDC ID..."
                  value={filters.ndcId || ''}
                  onChange={(e) => updateFilter('ndcId', e.target.value)}
                />
              </div>

              {/* Location Filter */}
              {locationsData?.getLocations && locationsData.getLocations.length > 0 && (
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select
                    value={filters.locationIds?.[0] || 'all'}
                    onValueChange={(value: string) => {
                      updateFilter('locationIds', value === 'all' ? undefined : [value]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Locations</SelectItem>
                      {locationsData.getLocations.map((location) => (
                        <SelectItem key={location.locationId} value={location.locationId}>
                          {location.name} ({location.temp})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Strength Range */}
              <div className="space-y-4">
                <Label>Strength Range (mg)</Label>
                <div className="px-2">
                  <Slider
                    min={0}
                    max={1000}
                    step={10}
                    value={strengthRange}
                    onValueChange={(value) => setStrengthRange(value as [number, number])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>{strengthRange[0]} mg</span>
                    <span>{strengthRange[1]} mg</span>
                  </div>
                </div>
                <Button onClick={applyStrengthFilter} variant="outline" size="sm" className="w-full">
                  Apply Strength Filter
                </Button>
              </div>

              {/* Sorting */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select
                    value={filters.sortBy || 'EXPIRY_DATE'}
                    onValueChange={(value: string) => {
                      updateSortBy(value as UnitSortField);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Order</Label>
                  <Select
                    value={filters.sortOrder || 'ASC'}
                    onValueChange={(value: string) => {
                      updateSortOrder(value as SortOrder);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASC">Ascending</SelectItem>
                      <SelectItem value="DESC">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
