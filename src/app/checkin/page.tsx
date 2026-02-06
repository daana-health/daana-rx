'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import { Printer, AlertCircle, Loader2, Plus, Check } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import {
  GetLocationsResponse,
  GetLotsResponse,
  LotData,
  LocationData,
  BatchCreatedUnit,
} from '../../types/graphql';
import { RootState } from '../../store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { UnitLabel } from '@/components/unit-label/UnitLabel';
import { QRCodeSVG } from 'qrcode.react';

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
      lotCode
      locationId
      dateCreated
      maxCapacity
      currentCapacity
      availableCapacity
    }
  }
`;

const GET_CLINIC = gql`
  query GetClinic {
    getClinic {
      clinicId
      requireLotLocation
    }
  }
`;

const CREATE_LOT = gql`
  mutation CreateLot($input: CreateLotInput!) {
    createLot(input: $input) {
      lotId
      source
      lotCode
      note
      maxCapacity
    }
  }
`;

const SEARCH_MEDICATIONS_BY_NAME = gql`
  query SearchMedicationsByName($query: String!) {
    searchMedicationsByName(query: $query) {
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

const BATCH_CREATE_UNITS = gql`
  mutation BatchCreateUnits($input: BatchCheckInInput!) {
    batchCreateUnits(input: $input) {
      unitId
      qrCode
      totalQuantity
      availableQuantity
      expiryDate
      drug {
        medicationName
        strength
        strengthUnit
        form
      }
    }
  }
`;

// Helper to get lot description from code
function getLotDescription(lotCode: string): string {
  if (!lotCode || lotCode.length === 0) return '';

  const firstChar = lotCode[0].toUpperCase();
  const drawerLetter = `Drawer ${firstChar}`;

  if (lotCode.length === 1) {
    return drawerLetter;
  }

  const secondChar = lotCode[1].toUpperCase();
  if (secondChar === 'L') {
    return `${drawerLetter} Left`;
  } else if (secondChar === 'R') {
    return `${drawerLetter} Right`;
  }

  return drawerLetter;
}

export default function CheckInPage() {
  const router = useRouter();
  const { toast } = useToast();
  const user = useSelector((state: RootState) => state.auth.user);

  // Form state
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [selectedLot, setSelectedLot] = useState<LotData | null>(null);
  const [medicationName, setMedicationName] = useState('');
  const [quantity, setQuantity] = useState<string>('1');
  const [dosage, setDosage] = useState('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [manufacturerLotNumber, setManufacturerLotNumber] = useState('');

  // Medication search state
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<any>(null);

  // New lot modal state
  const [showNewLotModal, setShowNewLotModal] = useState(false);
  const [newLotDrawer, setNewLotDrawer] = useState('A');
  const [newLotSide, setNewLotSide] = useState<'L' | 'R' | ''>('');
  const [newLotSource, setNewLotSource] = useState('');
  const [newLotNote, setNewLotNote] = useState('');
  const [newLotLocationId, setNewLotLocationId] = useState('');

  // Success state
  const [createdUnits, setCreatedUnits] = useState<BatchCreatedUnit[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // Print refs
  const printAllRef = useRef<HTMLDivElement | null>(null);
  const singlePrintRef = useRef<HTMLDivElement | null>(null);
  const [printingUnitIndex, setPrintingUnitIndex] = useState<number | null>(null);

  // Queries
  const { data: locationsData } = useQuery<GetLocationsResponse>(GET_LOCATIONS);
  const { data: lotsData, refetch: refetchLots } = useQuery<GetLotsResponse>(GET_LOTS);
  const { data: clinicData } = useQuery(GET_CLINIC);
  const { refetch: searchMedications } = useQuery(SEARCH_MEDICATIONS_BY_NAME, {
    skip: true,
  });

  const hasLocations = locationsData?.getLocations && locationsData.getLocations.length > 0;
  const isAdmin = user?.userRole === 'admin' || user?.userRole === 'superadmin';
  const requireLotLocation = clinicData?.getClinic?.requireLotLocation ?? false;

  // Mutations
  const [createLot, { loading: creatingLot }] = useMutation(CREATE_LOT, {
    onCompleted: (data) => {
      setSelectedLotId(data.createLot.lotId);
      setSelectedLot(data.createLot);
      setShowNewLotModal(false);
      setNewLotDrawer('A');
      setNewLotSide('');
      setNewLotSource('');
      setNewLotNote('');
      setNewLotLocationId('');
      refetchLots();
      toast({
        title: 'Success',
        description: `Lot ${data.createLot.lotCode} created successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [batchCreateUnits, { loading: creatingUnits }] = useMutation(BATCH_CREATE_UNITS, {
    refetchQueries: ['GetDashboardStats', 'GetUnits', 'GetUnitsAdvanced', 'GetLots'],
    awaitRefetchQueries: true,
    onCompleted: (data) => {
      setCreatedUnits(data.batchCreateUnits);
      setShowSuccess(true);
      toast({
        title: 'Success',
        description: `${data.batchCreateUnits.length} unit(s) created successfully!`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Print handlers
  const handlePrintAll = useReactToPrint({
    contentRef: printAllRef,
    documentTitle: `DaanaRX-Labels-Batch`,
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
        .page-break {
          page-break-after: always;
        }
      }
    `,
  });

  const handlePrintSingle = useReactToPrint({
    contentRef: singlePrintRef,
    documentTitle: `DaanaRX-Label`,
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

  // Debounced medication search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (medicationName.trim().length >= 2 && !selectedMedication) {
        handleMedicationSearch(medicationName);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [medicationName, selectedMedication]);

  const handleMedicationSearch = async (query: string) => {
    if (query.length < 2) return;

    setSearching(true);
    try {
      const result = await searchMedications({ query });
      const results = result.data?.searchMedicationsByName || [];
      setSearchResults(results);
      setShowDropdown(results.length > 0);
    } catch (error) {
      console.error('Medication search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectMedication = (med: any) => {
    setSelectedMedication(med);
    setMedicationName(med.medicationName);
    // Auto-fill dosage if strength info is available
    if (med.strength && med.strengthUnit) {
      setDosage(`${med.strength}${med.strengthUnit}`);
    }
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleClearMedication = () => {
    setSelectedMedication(null);
    setMedicationName('');
    setDosage('');
  };

  const handleCreateLot = () => {
    if (!newLotDrawer) {
      toast({
        title: 'Error',
        description: 'Please select a drawer letter',
        variant: 'destructive',
      });
      return;
    }

    if (requireLotLocation && !newLotSide) {
      toast({
        title: 'Error',
        description: 'Please select a side (L/R)',
        variant: 'destructive',
      });
      return;
    }

    if (!newLotLocationId) {
      toast({
        title: 'Error',
        description: 'Please select a storage location',
        variant: 'destructive',
      });
      return;
    }

    const lotCode = newLotSide ? `${newLotDrawer}${newLotSide}` : newLotDrawer;

    createLot({
      variables: {
        input: {
          lotCode,
          source: newLotSource || undefined,
          note: newLotNote || undefined,
          locationId: newLotLocationId,
        },
      },
    });
  };

  const handleSubmit = () => {
    // Validation
    if (!selectedLotId) {
      toast({
        title: 'Error',
        description: 'Please select a lot',
        variant: 'destructive',
      });
      return;
    }

    if (!medicationName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a medication name',
        variant: 'destructive',
      });
      return;
    }

    if (!dosage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter the dosage',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      toast({
        title: 'Error',
        description: 'Quantity must be at least 1',
        variant: 'destructive',
      });
      return;
    }

    batchCreateUnits({
      variables: {
        input: {
          lotId: selectedLotId,
          medicationName: medicationName.trim(),
          dosage: dosage.trim(),
          quantity: qty,
          expiryDate: expiryDate || undefined,
          manufacturerLotNumber: manufacturerLotNumber || undefined,
        },
      },
    });
  };

  const handleReset = () => {
    setSelectedLotId('');
    setSelectedLot(null);
    setMedicationName('');
    setSelectedMedication(null);
    setQuantity('1');
    setDosage('');
    setExpiryDate('');
    setManufacturerLotNumber('');
    setCreatedUnits([]);
    setShowSuccess(false);
  };

  const isFormValid = () => {
    return (
      selectedLotId &&
      medicationName.trim() &&
      dosage.trim() &&
      parseInt(quantity, 10) >= 1
    );
  };

  // Success view - show created units with QR codes
  if (showSuccess && createdUnits.length > 0) {
    return (
      <AppShell>
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-3">
              <Check className="h-8 w-8 text-green-600" />
              Check-In Complete
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              {createdUnits.length} unit(s) created successfully. Print labels and attach to medications.
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-xl">Generated Labels ({createdUnits.length})</CardTitle>
                <Button onClick={() => handlePrintAll()} size="lg">
                  <Printer className="mr-2 h-5 w-5" />
                  Print All Labels
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Printable container for all labels */}
              <div ref={printAllRef} className="hidden print:block">
                {createdUnits.map((unit, index) => (
                  <div key={unit.unitId} className={index < createdUnits.length - 1 ? 'page-break' : ''}>
                    <UnitLabel
                      unitId={unit.unitId}
                      medicationName={unit.drug.medicationName}
                      genericName={unit.drug.medicationName}
                      strength={unit.drug.strength}
                      strengthUnit={unit.drug.strengthUnit}
                      form={unit.drug.form}
                      ndcId=""
                      manufacturerLotNumber={manufacturerLotNumber || null}
                      availableQuantity={unit.availableQuantity}
                      totalQuantity={unit.totalQuantity}
                      expiryDate={unit.expiryDate}
                      donationSource={selectedLot?.source || null}
                      locationName={null}
                    />
                  </div>
                ))}
              </div>

              {/* Single print ref */}
              <div ref={singlePrintRef} className="hidden print:block">
                {printingUnitIndex !== null && createdUnits[printingUnitIndex] && (
                  <UnitLabel
                    unitId={createdUnits[printingUnitIndex].unitId}
                    medicationName={createdUnits[printingUnitIndex].drug.medicationName}
                    genericName={createdUnits[printingUnitIndex].drug.medicationName}
                    strength={createdUnits[printingUnitIndex].drug.strength}
                    strengthUnit={createdUnits[printingUnitIndex].drug.strengthUnit}
                    form={createdUnits[printingUnitIndex].drug.form}
                    ndcId=""
                    manufacturerLotNumber={manufacturerLotNumber || null}
                    availableQuantity={createdUnits[printingUnitIndex].availableQuantity}
                    totalQuantity={createdUnits[printingUnitIndex].totalQuantity}
                    expiryDate={createdUnits[printingUnitIndex].expiryDate}
                    donationSource={selectedLot?.source || null}
                    locationName={null}
                  />
                )}
              </div>

              {/* Visible preview of units */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {createdUnits.map((unit, index) => (
                  <Card key={unit.unitId} className="p-4">
                    <div className="flex flex-col items-center gap-3">
                      <QRCodeSVG value={unit.qrCode} size={80} level="H" />
                      <div className="text-center">
                        <p className="font-mono text-xs text-muted-foreground break-all">
                          {unit.qrCode}
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {unit.drug.medicationName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {unit.drug.strength}{unit.drug.strengthUnit} - {unit.drug.form}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPrintingUnitIndex(index);
                          setTimeout(() => handlePrintSingle(), 100);
                        }}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button onClick={handleReset} size="lg" variant="outline">
              <Plus className="mr-2 h-5 w-5" />
              Check In More Medications
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

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

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-xl">New Check-In</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Lot Selection */}
            <div className="space-y-3">
              <Label htmlFor="lot-select" className="text-base font-semibold">
                Lot # <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-3">
                <Select
                  value={selectedLotId}
                  onValueChange={(value) => {
                    if (value === 'new') {
                      setShowNewLotModal(true);
                    } else {
                      setSelectedLotId(value);
                      const lot = lotsData?.getLots.find((l: LotData) => l.lotId === value);
                      setSelectedLot(lot || null);
                    }
                  }}
                >
                  <SelectTrigger id="lot-select" className="flex-1">
                    <SelectValue placeholder="Select lot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new" className="font-semibold text-primary">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add New Lot
                      </div>
                    </SelectItem>
                    {lotsData?.getLots.map((lot: LotData) => (
                      <SelectItem key={lot.lotId} value={lot.lotId}>
                        {lot.lotCode ? (
                          <span>
                            <strong>{lot.lotCode}</strong> - {getLotDescription(lot.lotCode)}
                            {lot.source && <span className="text-muted-foreground"> ({lot.source})</span>}
                          </span>
                        ) : (
                          <span>{lot.source || 'Unnamed Lot'} - {new Date(lot.dateCreated).toLocaleDateString()}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedLot && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedLot.lotCode ? `${selectedLot.lotCode} - ${getLotDescription(selectedLot.lotCode)}` : selectedLot.source}
                  {selectedLot.maxCapacity && selectedLot.currentCapacity !== undefined && (
                    <span> ({selectedLot.currentCapacity}/{selectedLot.maxCapacity} capacity used)</span>
                  )}
                </p>
              )}
            </div>

            {/* Medication Name */}
            <div className="space-y-3">
              <Label htmlFor="medication-name" className="text-base font-semibold">
                Medication Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                {selectedMedication ? (
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-accent/50">
                    <div className="flex-1">
                      <p className="font-semibold">{selectedMedication.medicationName}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedMedication.strength}{selectedMedication.strengthUnit} - {selectedMedication.form}
                        {selectedMedication.inInventory && (
                          <Badge variant="secondary" className="ml-2 text-xs">In Stock</Badge>
                        )}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClearMedication}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="medication-name"
                      placeholder="Type to search medications..."
                      value={medicationName}
                      onChange={(e) => {
                        setMedicationName(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowDropdown(true);
                      }}
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {showDropdown && searchResults.length > 0 && (
                      <Card className="absolute z-50 w-full mt-1 max-h-[300px] overflow-auto">
                        <CardContent className="p-2 space-y-1">
                          {searchResults.map((med, index) => (
                            <div
                              key={index}
                              className={cn(
                                'p-3 rounded-md cursor-pointer hover:bg-accent transition-colors',
                                med.inInventory && 'bg-blue-50 dark:bg-blue-950/20'
                              )}
                              onClick={() => handleSelectMedication(med)}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1">
                                  <p className="font-semibold text-sm">{med.medicationName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {med.strength}{med.strengthUnit} - {med.form}
                                  </p>
                                </div>
                                {med.inInventory && (
                                  <Badge variant="secondary" className="text-xs">In Stock</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Search existing medications or type a new name
              </p>
            </div>

            {/* Quantity */}
            <div className="space-y-3">
              <Label htmlFor="quantity" className="text-base font-semibold">
                Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Each unit will receive its own unique QR code label
              </p>
            </div>

            {/* Dosage */}
            <div className="space-y-3">
              <Label htmlFor="dosage" className="text-base font-semibold">
                Dosage <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dosage"
                placeholder="e.g., 500mg, 10mg/5ml"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
            </div>

            {/* Expiration Date - Optional */}
            <div className="space-y-3">
              <Label htmlFor="expiry-date" className="text-base font-semibold">
                Expiration Date <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="MM/DD/YYYY"
              />
            </div>

            {/* Manufacturer Lot Number - Optional */}
            <div className="space-y-3">
              <Label htmlFor="mfr-lot" className="text-base font-semibold">
                Medication Lot # <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="mfr-lot"
                placeholder="From medication package"
                value={manufacturerLotNumber}
                onChange={(e) => setManufacturerLotNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The manufacturer's lot number from the medication package label
              </p>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t">
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid() || creatingUnits}
                size="lg"
                className="w-full"
              >
                {creatingUnits && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Check In {parseInt(quantity, 10) > 1 ? `${quantity} Units` : '1 Unit'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* New Lot Modal */}
        <Dialog open={showNewLotModal} onOpenChange={setShowNewLotModal}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create New Lot</DialogTitle>
              <DialogDescription className="text-base">
                Create a lot code for organizing medications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              {/* Drawer Letter */}
              <div className="space-y-3">
                <Label htmlFor="drawer-letter" className="text-base font-semibold">
                  Drawer Letter <span className="text-destructive">*</span>
                </Label>
                <Select value={newLotDrawer} onValueChange={setNewLotDrawer}>
                  <SelectTrigger id="drawer-letter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
                      <SelectItem key={letter} value={letter}>
                        Drawer {letter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Side (L/R) - Conditional */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  Side {requireLotLocation ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(Optional)</span>}
                </Label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={newLotSide === 'L' ? 'default' : 'outline'}
                    onClick={() => setNewLotSide(newLotSide === 'L' ? '' : 'L')}
                    className="flex-1"
                  >
                    L - Left
                  </Button>
                  <Button
                    type="button"
                    variant={newLotSide === 'R' ? 'default' : 'outline'}
                    onClick={() => setNewLotSide(newLotSide === 'R' ? '' : 'R')}
                    className="flex-1"
                  >
                    R - Right
                  </Button>
                </div>
                {newLotDrawer && (
                  <p className="text-sm text-muted-foreground">
                    Lot code will be: <strong>{newLotSide ? `${newLotDrawer}${newLotSide}` : newLotDrawer}</strong> ({getLotDescription(newLotSide ? `${newLotDrawer}${newLotSide}` : newLotDrawer)})
                  </p>
                )}
              </div>

              {/* Storage Location */}
              <div className="space-y-3">
                <Label htmlFor="lot-location" className="text-base font-semibold">
                  Storage Location <span className="text-destructive">*</span>
                </Label>
                <Select value={newLotLocationId} onValueChange={setNewLotLocationId}>
                  <SelectTrigger id="lot-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationsData?.getLocations.map((loc: LocationData) => (
                      <SelectItem key={loc.locationId} value={loc.locationId}>
                        {loc.name} ({loc.temp.replace('_', ' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Donation Source - Optional */}
              <div className="space-y-3">
                <Label htmlFor="lot-source" className="text-base font-semibold">
                  Donation Source <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Input
                  id="lot-source"
                  placeholder="e.g., CVS Pharmacy, Patient Donation"
                  value={newLotSource}
                  onChange={(e) => setNewLotSource(e.target.value)}
                />
              </div>

              {/* Note - Optional */}
              <div className="space-y-3">
                <Label htmlFor="lot-note" className="text-base font-semibold">
                  Note <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Textarea
                  id="lot-note"
                  placeholder="Any additional notes about this lot"
                  value={newLotNote}
                  onChange={(e) => setNewLotNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewLotModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLot} disabled={creatingLot}>
                {creatingLot && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Lot
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
