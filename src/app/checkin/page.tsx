'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import { QrCodeIcon, Printer, AlertCircle, Loader2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { LotCapacityAlert } from '../../components/LotCapacityAlert';
import { LotCapacityStatus, useCapacityValidation } from '../../components/LotCapacityStatus';
import {
  GetLocationsResponse,
  GetLotsResponse,
  DrugData,
  LotData,
  LocationData,
} from '../../types/graphql';
import { RootState } from '../../store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Stepper, Step } from '@/components/ui/stepper';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { UnitLabel } from '@/components/unit-label/UnitLabel';

const GET_LOCATIONS = gql`
  query GetLocations {
    getLocations {
      locationId
      name
      temp
    }
  }
`;

const GET_LOTS = gql`
  query GetLots {
    getLots {
      lotId
      source
      locationId
      dateCreated
      maxCapacity
      currentCapacity
      availableCapacity
    }
  }
`;

const CREATE_LOT = gql`
  mutation CreateLot($input: CreateLotInput!) {
    createLot(input: $input) {
      lotId
      source
      note
      maxCapacity
    }
  }
`;

const SEARCH_DRUGS = gql`
  query SearchDrugs($query: String!) {
    searchDrugs(query: $query) {
      drugId
      medicationName
      genericName
      strength
      strengthUnit
      ndcId
      form
      inInventory
    }
  }
`;

const CREATE_UNIT = gql`
  mutation CreateUnit($input: CreateUnitInput!) {
    createUnit(input: $input) {
      unitId
      totalQuantity
      availableQuantity
      expiryDate
      drug {
        medicationName
        genericName
      }
    }
  }
`;

export default function CheckInPage() {
  const router = useRouter();
  const { toast } = useToast();
  const user = useSelector((state: RootState) => state.auth.user);
  const [activeStep, setActiveStep] = useState(0);

  // Lot creation state
  const [lotSource, setLotSource] = useState('');
  const [lotNote, setLotNote] = useState('');
  const [lotMaxCapacity, setLotMaxCapacity] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [selectedLot, setSelectedLot] = useState<LotData | null>(null);
  const [useExistingLot, setUseExistingLot] = useState(false);

  // Unified drug search state
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<DrugData | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualDrug, setManualDrug] = useState<Omit<DrugData, 'drugId'>>({
    medicationName: '',
    genericName: '',
    strength: 0,
    strengthUnit: 'mg',
    ndcId: '',
    form: 'Tablet',
  });

  // Unit creation state
  const [totalQuantity, setTotalQuantity] = useState<string>('');
  const [availableQuantity, setAvailableQuantity] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [manufacturerLotNumber, setManufacturerLotNumber] = useState('');
  const [unitNotes, setUnitNotes] = useState('');
  const [createdUnitId, setCreatedUnitId] = useState<string>('');
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Scanner state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  
  // Print ref
  const printRef = useRef<HTMLDivElement | null>(null);

  // Queries
  const { data: locationsData } = useQuery<GetLocationsResponse>(GET_LOCATIONS);
  const { data: lotsData } = useQuery<GetLotsResponse>(GET_LOTS);
  const { refetch: searchDrugs } = useQuery(SEARCH_DRUGS, {
    skip: true,
  });
  
  // Print handler
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `DaanaRX-Label-${createdUnitId}`,
    pageStyle: `
      @page {
        size: 4in 2in;
        margin: 0;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
        }
      }
    `,
  });
  
  const hasLocations = locationsData?.getLocations && locationsData.getLocations.length > 0;
  const isAdmin = user?.userRole === 'admin' || user?.userRole === 'superadmin';

  // Step validation functions
  const isStep1Valid = () => {
    if (useExistingLot) {
      return selectedLotId !== '';
    }
    return lotSource.trim() !== '' && selectedLocationId !== '';
  };

  const isStep2Valid = () => {
    if (selectedDrug) {
      return true;
    }
    return (
      manualDrug.medicationName.trim() !== '' &&
      manualDrug.genericName.trim() !== '' &&
      manualDrug.strength > 0 &&
      manualDrug.strengthUnit.trim() !== '' &&
      manualDrug.ndcId.trim() !== '' &&
      manualDrug.form.trim() !== ''
    );
  };

  const isStep3Valid = () => {
    const qty = parseInt(totalQuantity, 10);
    if (isNaN(qty) || qty <= 0 || expiryDate === null || !manufacturerLotNumber.trim()) {
      return false;
    }

    if (
      selectedLot?.maxCapacity &&
      selectedLot.currentCapacity !== undefined &&
      selectedLot.currentCapacity !== null
    ) {
      const currentCap = selectedLot.currentCapacity ?? 0;
      const maxCap = selectedLot.maxCapacity ?? 0;
      return useCapacityValidation(currentCap, maxCap, qty);
    }

    return true;
  };

  const nextStep = () => {
    if (activeStep === 0 && isStep1Valid()) {
      setActiveStep(1);
    } else if (activeStep === 1 && isStep2Valid()) {
      setActiveStep(2);
    }
  };

  const prevStep = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  // Debounced unified search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput.trim().length >= 2) {
        handleUnifiedSearch(searchInput);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const handleUnifiedSearch = async (searchTerm: string) => {
    if (searchTerm.length < 2) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const result = await searchDrugs({ query: searchTerm });
      if (result.data?.searchDrugs && result.data.searchDrugs.length > 0) {
        setSearchResults(result.data.searchDrugs);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
        const cleanedNDC = searchTerm.replace(/[^0-9]/g, '');
        if (cleanedNDC.length >= 10) {
          setManualDrug({ ...manualDrug, ndcId: cleanedNDC });
          setShowManualEntry(true);
        }
      }
    } catch (error) {
      console.error('Drug search error:', error);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectDrug = (drug: any) => {
    setSelectedDrug(drug);
    setSearchInput(drug.ndcId);
    setSearchResults([]);
    setShowDropdown(false);
    setShowManualEntry(false);
    toast({
      title: 'Drug Selected',
      description: drug.inInventory 
        ? `${drug.medicationName} (Already in inventory)` 
        : drug.medicationName,
    });
  };

  // Mutations
  const [createLot, { loading: creatingLot }] = useMutation(CREATE_LOT, {
    refetchQueries: [{ query: GET_LOTS }],
    onCompleted: (data) => {
      setSelectedLotId(data.createLot.lotId);
      setSelectedLot(data.createLot);
      toast({
        title: 'Success',
        description: 'Lot created successfully',
      });
      setActiveStep(1);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [createUnit, { loading: creatingUnit }] = useMutation(CREATE_UNIT, {
    refetchQueries: ['GetDashboardStats', 'GetUnits'],
    onCompleted: (data) => {
      setCreatedUnitId(data.createUnit.unitId);
      toast({
        title: 'Success',
        description: `Unit created successfully! Transaction logged.`,
      });
      setShowQRModal(true);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreateLot = () => {
    if (useExistingLot) {
      if (!selectedLotId) {
        toast({
          title: 'Error',
          description: 'Please select a lot',
          variant: 'destructive',
        });
        return;
      }
      setActiveStep(1);
      return;
    }

    const maxCap = lotMaxCapacity ? parseInt(lotMaxCapacity, 10) : undefined;
    createLot({
      variables: {
        input: {
          source: lotSource,
          note: lotNote,
          locationId: selectedLocationId,
          maxCapacity: maxCap,
        },
      },
    });
  };

  const handleBarcodeScanned = (code: string) => {
    setShowBarcodeScanner(false);
    setSearchInput(code);
  };

  const handleCreateUnit = () => {
    if (!selectedLotId || !expiryDate) {
      toast({
        title: 'Error',
        description: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    const drugData = selectedDrug || manualDrug;
    const qty = parseInt(totalQuantity, 10);
    const availQty = parseInt(availableQuantity, 10);

    createUnit({
      variables: {
        input: {
          totalQuantity: qty,
          availableQuantity: availQty,
          lotId: selectedLotId,
          expiryDate: expiryDate.toISOString().split('T')[0],
          drugId: selectedDrug?.drugId,
          drugData: !selectedDrug?.drugId ? drugData : undefined,
          manufacturerLotNumber: manufacturerLotNumber || undefined,
          optionalNotes: unitNotes,
        },
      },
    });
  };

  const handleReset = () => {
    setActiveStep(0);
    setLotSource('');
    setLotNote('');
    setLotMaxCapacity('');
    setSelectedLocationId('');
    setSelectedLotId('');
    setSelectedLot(null);
    setUseExistingLot(false);
    setSearchInput('');
    setSelectedDrug(null);
    setShowManualEntry(false);
    setManualDrug({
      medicationName: '',
      genericName: '',
      strength: 0,
      strengthUnit: 'mg',
      ndcId: '',
      form: 'Tablet',
    });
    setTotalQuantity('');
    setAvailableQuantity('');
    setExpiryDate(null);
    setManufacturerLotNumber('');
    setUnitNotes('');
    setCreatedUnitId('');
    setShowQRModal(false);
  };

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Check In</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Add new medications to inventory
          </p>
        </div>

        {!hasLocations && (
          <Alert variant={isAdmin ? 'default' : 'destructive'} className="animate-slide-in">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-base">
              {isAdmin ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <span>You need to create at least one storage location before checking in medications.</span>
                  <Button variant="outline" size="sm" onClick={() => router.push('/admin')} className="w-full sm:w-auto">
                    Go to Admin
                  </Button>
                </div>
              ) : (
                'No storage locations are available. Please contact your administrator to create storage locations before checking in medications.'
              )}
            </AlertDescription>
          </Alert>
        )}

        <Stepper activeStep={activeStep}>
          <Step label="Create Lot" description="Donation source">
            <Card className="animate-fade-in">
              <CardContent className="pt-6 space-y-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant={!useExistingLot ? 'default' : 'outline'}
                    onClick={() => setUseExistingLot(false)}
                    size="lg"
                    className="flex-1"
                  >
                    Create New Lot
                  </Button>
                  <Button
                    variant={useExistingLot ? 'default' : 'outline'}
                    onClick={() => setUseExistingLot(true)}
                    size="lg"
                    className="flex-1"
                  >
                    Use Existing Lot
                  </Button>
                </div>

                {useExistingLot ? (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <Label htmlFor="select-lot" className="text-base font-semibold">Select Lot</Label>
                      <Select value={selectedLotId} onValueChange={(value) => {
                        setSelectedLotId(value);
                        const lot = lotsData?.getLots.find((l: LotData) => l.lotId === value);
                        setSelectedLot(lot || null);
                      }}>
                        <SelectTrigger id="select-lot">
                          <SelectValue placeholder="Choose existing lot" />
                        </SelectTrigger>
                        <SelectContent>
                          {lotsData?.getLots.map((lot: LotData) => {
                            let label = `${lot.source} - ${new Date(lot.dateCreated).toLocaleDateString()}`;
                            if (lot.maxCapacity && lot.currentCapacity !== undefined && lot.currentCapacity !== null) {
                              const available = lot.maxCapacity - lot.currentCapacity;
                              label += ` (${lot.currentCapacity}/${lot.maxCapacity}, ${available} available)`;
                            }
                            return (
                              <SelectItem key={lot.lotId} value={lot.lotId}>
                                {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedLot && selectedLot.maxCapacity && selectedLot.currentCapacity !== undefined && selectedLot.currentCapacity !== null && (
                      <LotCapacityAlert
                        currentCapacity={selectedLot.currentCapacity}
                        maxCapacity={selectedLot.maxCapacity}
                        showAvailable
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="lot-source">Donation Source *</Label>
                      <Input
                        id="lot-source"
                        placeholder="e.g., CVS Pharmacy"
                        value={lotSource}
                        onChange={(e) => setLotSource(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location">Storage Location *</Label>
                      <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                        <SelectTrigger id="location">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locationsData?.getLocations.map((loc: LocationData) => (
                            <SelectItem key={loc.locationId} value={loc.locationId}>
                              {loc.name} ({loc.temp})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max-capacity">Maximum Capacity (Optional)</Label>
                      <Input
                        id="max-capacity"
                        type="number"
                        placeholder="e.g., 100"
                        value={lotMaxCapacity}
                        onChange={(e) => setLotMaxCapacity(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum number of units that can be stored in this lot
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lot-notes">Notes (Optional)</Label>
                      <Textarea
                        id="lot-notes"
                        placeholder="Any additional information"
                        value={lotNote}
                        onChange={(e) => setLotNote(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {!useExistingLot && (
                  <Button onClick={handleCreateLot} disabled={creatingLot} size="lg" className="w-full">
                    {creatingLot && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Create Lot
                  </Button>
                )}

                <div className="flex justify-end mt-6">
                  <Button onClick={nextStep} disabled={!isStep1Valid()}>
                    Next Step
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Step>

          <Step label="Find Drug" description="NDC or manual entry">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Button
                  variant="outline"
                  onClick={() => setShowBarcodeScanner(true)}
                  size="lg"
                  className="w-full"
                >
                  <QrCodeIcon className="mr-2 h-5 w-5" />
                  Scan Barcode
                </Button>

                <div className="relative space-y-2">
                  <Label htmlFor="drug-search">Search by Drug Name or NDC</Label>
                  <div className="relative">
                    <Input
                      id="drug-search"
                      placeholder="Start typing drug name or NDC code..."
                      value={searchInput}
                      onChange={(e) => {
                        setSearchInput(e.target.value);
                        setShowDropdown(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowDropdown(false);
                        }
                      }}
                      onFocus={() => {
                        if (searchResults.length > 0) {
                          setShowDropdown(true);
                        }
                      }}
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {showDropdown && searchResults.length > 0 && (
                    <Card className="absolute z-50 w-full mt-1 max-h-[400px] overflow-auto">
                      <CardContent className="p-2 space-y-1">
                        {searchResults.length > 5 && (
                          <p className="text-xs text-center text-muted-foreground py-2 sticky top-0 bg-card">
                            Showing {searchResults.length} results - Scroll for more ↓
                          </p>
                        )}
                        {searchResults.map((drug, index) => (
                          <div
                            key={index}
                            className={cn(
                              "p-3 rounded-md cursor-pointer hover:bg-accent",
                              drug.inInventory && "bg-blue-50 dark:bg-blue-950/20"
                            )}
                            onClick={() => handleSelectDrug(drug)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-sm">{drug.medicationName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {drug.strength} {drug.strengthUnit} - {drug.form}
                                </p>
                                <p className="text-xs text-blue-600">NDC: {drug.ndcId}</p>
                              </div>
                              {drug.inInventory && (
                                <Badge variant="secondary" className="text-xs">In Stock</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {selectedDrug && (
                  <Card className="bg-accent/50 border-primary/20 animate-fade-in">
                    <CardContent className="pt-5">
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <p className="font-bold text-lg">{selectedDrug.medicationName}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedDrug.strength} {selectedDrug.strengthUnit} - {selectedDrug.form}
                          </p>
                          <p className="text-xs text-muted-foreground">NDC: {selectedDrug.ndcId}</p>
                        </div>
                        {selectedDrug.inInventory && (
                          <Badge className="bg-primary/10 text-primary border-primary/20">Already in Inventory</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!selectedDrug && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowManualEntry(!showManualEntry)}
                      size="lg"
                      className="w-full"
                    >
                      {showManualEntry ? 'Hide Manual Entry' : 'Enter Drug Manually'}
                    </Button>

                    {showManualEntry && (
                      <div className="space-y-4 pt-4">
                        <h3 className="text-lg font-semibold">Manual Drug Entry:</h3>
                        
                        <div className="space-y-2">
                          <Label htmlFor="med-name">Medication Name *</Label>
                          <Input
                            id="med-name"
                            placeholder="e.g., Fluoxetine"
                            value={manualDrug.medicationName}
                            onChange={(e) => setManualDrug({ ...manualDrug, medicationName: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="generic-name">Generic Name *</Label>
                          <Input
                            id="generic-name"
                            placeholder="e.g., Prozac"
                            value={manualDrug.genericName}
                            onChange={(e) => setManualDrug({ ...manualDrug, genericName: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="strength">Strength *</Label>
                            <Input
                              id="strength"
                              type="number"
                              placeholder="10"
                              value={manualDrug.strength || ''}
                              onChange={(e) => setManualDrug({ ...manualDrug, strength: Number(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="strength-unit">Unit *</Label>
                            <Select value={manualDrug.strengthUnit} onValueChange={(value) => setManualDrug({ ...manualDrug, strengthUnit: value })}>
                              <SelectTrigger id="strength-unit">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mg">mg (milligrams)</SelectItem>
                                <SelectItem value="g">g (grams)</SelectItem>
                                <SelectItem value="mcg">mcg (micrograms)</SelectItem>
                                <SelectItem value="kg">kg (kilograms)</SelectItem>
                                <SelectItem value="mL">mL (milliliters)</SelectItem>
                                <SelectItem value="L">L (liters)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="ndc">NDC ID *</Label>
                            <Input
                              id="ndc"
                              placeholder="Enter NDC code"
                              value={manualDrug.ndcId}
                              onChange={(e) => setManualDrug({ ...manualDrug, ndcId: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="form">Form *</Label>
                            <Select value={manualDrug.form} onValueChange={(value) => setManualDrug({ ...manualDrug, form: value })}>
                              <SelectTrigger id="form">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Tablet">Tablet</SelectItem>
                                <SelectItem value="Capsule">Capsule</SelectItem>
                                <SelectItem value="Liquid">Liquid</SelectItem>
                                <SelectItem value="Injection">Injection</SelectItem>
                                <SelectItem value="Cream">Cream</SelectItem>
                                <SelectItem value="Ointment">Ointment</SelectItem>
                                <SelectItem value="Patch">Patch</SelectItem>
                                <SelectItem value="Inhaler">Inhaler</SelectItem>
                                <SelectItem value="Suppository">Suppository</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-8 pt-6 border-t">
                  <Button variant="outline" onClick={prevStep} className="w-full sm:w-auto">
                    Previous
                  </Button>
                  <Button onClick={nextStep} disabled={!isStep2Valid()} className="w-full sm:w-auto">
                    Next Step
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Step>

          <Step label="Create Unit" description="Quantity and expiry">
            <Card className="animate-fade-in">
              <CardContent className="pt-6 space-y-5">
                {selectedLot && selectedLot.maxCapacity && selectedLot.currentCapacity !== undefined && selectedLot.currentCapacity !== null && (
                  <LotCapacityAlert
                    currentCapacity={selectedLot.currentCapacity ?? 0}
                    maxCapacity={selectedLot.maxCapacity ?? 0}
                    showAvailable
                    variant="info"
                  />
                )}

                <div className="space-y-3">
                  <Label htmlFor="total-qty" className="text-base font-semibold">Total Quantity *</Label>
                  <Input
                    id="total-qty"
                    type="number"
                    placeholder="100"
                    value={totalQuantity}
                    onChange={(e) => {
                      setTotalQuantity(e.target.value);
                      setAvailableQuantity(e.target.value);
                    }}
                  />
                </div>

                {selectedLot && selectedLot.maxCapacity && selectedLot.currentCapacity !== undefined && selectedLot.currentCapacity !== null && parseInt(totalQuantity) > 0 && (
                  <LotCapacityStatus
                    currentCapacity={selectedLot.currentCapacity ?? 0}
                    maxCapacity={selectedLot.maxCapacity ?? 0}
                    addingQuantity={parseInt(totalQuantity) || 0}
                  />
                )}

                <div className="space-y-3">
                  <Label htmlFor="expiry-date" className="text-base font-semibold">Expiry Date *</Label>
                  <DatePicker
                    date={expiryDate}
                    onDateChange={setExpiryDate}
                    placeholder="Select expiry date"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="manufacturer-lot" className="text-base font-semibold">
                    Manufacturer Lot Number *
                    <span className="text-xs text-muted-foreground font-normal ml-2">(FDA Required for Recall Tracking)</span>
                  </Label>
                  <Input
                    id="manufacturer-lot"
                    placeholder="Enter manufacturer's lot number from package"
                    value={manufacturerLotNumber}
                    onChange={(e) => setManufacturerLotNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is different from the donation source. Find the lot number on the medication package.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="unit-notes" className="text-base font-semibold">Notes (Optional)</Label>
                  <Textarea
                    id="unit-notes"
                    placeholder="Any additional notes"
                    value={unitNotes}
                    onChange={(e) => setUnitNotes(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row justify-between gap-3 mt-8 pt-6 border-t">
                  <Button variant="outline" onClick={prevStep} className="w-full sm:w-auto">
                    Previous
                  </Button>
                  <Button onClick={handleCreateUnit} disabled={!isStep3Valid() || creatingUnit} className="w-full sm:w-auto">
                    {creatingUnit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Unit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Step>
        </Stepper>

        {/* Success Modal with QR Code */}
        <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Unit Created Successfully</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <Alert className="border-success/50 bg-success/5">
                <AlertDescription className="text-base">
                  Unit has been added to inventory. Print the label below and attach it to the medication.
                </AlertDescription>
              </Alert>
              
              {/* Printable Label */}
              <div className="flex justify-center">
                <div ref={printRef}>
                  <UnitLabel
                    unitId={createdUnitId}
                    medicationName={selectedDrug?.medicationName || manualDrug.medicationName}
                    genericName={selectedDrug?.genericName || manualDrug.genericName}
                    strength={selectedDrug?.strength || manualDrug.strength}
                    strengthUnit={selectedDrug?.strengthUnit || manualDrug.strengthUnit}
                    form={selectedDrug?.form || manualDrug.form}
                    ndcId={selectedDrug?.ndcId || manualDrug.ndcId}
                    manufacturerLotNumber={manufacturerLotNumber || null}
                    availableQuantity={availableQuantity || totalQuantity}
                    totalQuantity={totalQuantity}
                    expiryDate={expiryDate}
                    donationSource={selectedLot?.source || lotSource || null}
                    locationName={
                      (() => {
                        const locId = selectedLot?.locationId || selectedLocationId;
                        const loc = locationsData?.getLocations?.find((l: LocationData) => l.locationId === locId);
                        return loc?.name || null;
                      })()
                    }
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button onClick={() => handlePrint()} size="lg" className="w-full sm:w-auto">
                  <Printer className="mr-2 h-5 w-5" />
                  Print Label
                </Button>
                <Button variant="outline" onClick={handleReset} size="lg" className="w-full sm:w-auto">
                  Add Another Unit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <BarcodeScanner
          opened={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScan={handleBarcodeScanned}
          title="Scan NDC Barcode"
          description="Position the NDC barcode within the frame to search for drug information"
        />
      </div>
    </AppShell>
  );
}
