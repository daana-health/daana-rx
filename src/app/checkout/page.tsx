'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLazyQuery, useMutation, useQuery, gql } from '@apollo/client';
import { QrCodeIcon, AlertCircle, Loader2, MoreVertical, ShoppingCart, AlertTriangle, QrCode as QrCodeIconAlt, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { AppShell } from '../../components/layout/AppShell';
import { QRScanner } from '../../components/QRScanner';
import { GetUnitResponse, SearchUnitsResponse, UnitData } from '../../types/graphql';
import { UnitLabel } from '@/components/unit-label/UnitLabel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const GET_UNIT = gql`
  query GetUnit($unitId: ID!) {
    getUnit(unitId: $unitId) {
      unitId
      totalQuantity
      availableQuantity
      expiryDate
      optionalNotes
      manufacturerLotNumber
      drug {
        medicationName
        genericName
        strength
        strengthUnit
        form
        ndcId
      }
      lot {
        source
        note
        locationId
        location {
          name
          temp
        }
      }
    }
  }
`;

const SEARCH_UNITS = gql`
  query SearchUnits($query: String!) {
    searchUnitsByQuery(query: $query) {
      unitId
      totalQuantity
      availableQuantity
      expiryDate
      optionalNotes
      manufacturerLotNumber
      drug {
        medicationName
        genericName
        strength
        strengthUnit
        ndcId
        form
      }
      lot {
        source
        location {
          locationId
          name
          temp
        }
      }
    }
  }
`;

const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats($clinicId: ID) {
    getDashboardStats(clinicId: $clinicId) {
      totalUnits
    }
  }
`;

const CHECK_OUT_UNIT = gql`
  mutation CheckOutUnit($input: CheckOutInput!) {
    checkOutUnit(input: $input) {
      transactionId
      timestamp
      quantity
    }
  }
`;

const CHECK_OUT_FEFO = gql`
  mutation CheckOutMedicationFEFO($input: FEFOCheckOutInput!) {
    checkOutMedicationFEFO(input: $input) {
      totalQuantityDispensed
      unitsUsed {
        unitId
        quantityTaken
        expiryDate
        medicationName
      }
      transactions {
        transactionId
        timestamp
        quantity
      }
    }
  }
`;

function CheckOutContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [unitId, setUnitId] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [patientName, setPatientName] = useState('');
  const [patientReference, setPatientReference] = useState('');
  const [notes, setNotes] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const [viewedUnit, setViewedUnit] = useState<UnitData | null>(null);
  const [showUnitDetailsModal, setShowUnitDetailsModal] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);

  // Check if inventory is empty
  const clinicStr = typeof window !== 'undefined' ? localStorage.getItem('clinic') : null;
  const clinicId = clinicStr ? (() => { try { return JSON.parse(clinicStr).clinicId as string | undefined; } catch { return undefined; } })() : undefined;

  const { data: dashboardData, loading: loadingStats } = useQuery(GET_DASHBOARD_STATS, {
    variables: { clinicId },
    fetchPolicy: 'network-only',
  });
  const hasInventory = dashboardData?.getDashboardStats?.totalUnits > 0;

  const [getUnit, { data: unitData, loading: loadingUnit, error: unitError }] = useLazyQuery<GetUnitResponse>(GET_UNIT);

  const [searchUnits, { data: searchData, loading: searchingUnits }] = useLazyQuery<SearchUnitsResponse>(SEARCH_UNITS);

  const [checkOut, { loading: checkingOut }] = useMutation(CHECK_OUT_UNIT, {
    onCompleted: () => {
      toast({
        title: 'Success',
        description: 'Unit checked out successfully',
      });
      handleReset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [checkOutFEFO, { loading: checkingOutFEFO }] = useMutation(CHECK_OUT_FEFO, {
    onCompleted: (data) => {
      const result = data.checkOutMedicationFEFO;
      toast({
        title: 'Success',
        description: `Checked out ${result.totalQuantityDispensed} units from ${result.unitsUsed.length} container(s) using FEFO logic`,
      });
      handleReset();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSearch = () => {
    if (unitId.trim().length >= 2) {
      if (unitId.length === 36) {
        // Full UUID
        getUnit({ variables: { unitId } });
      } else {
        // Partial search - fuzzy search for unit ID or drug name
        searchUnits({ variables: { query: unitId } });
      }
    }
  };

  // Handle getUnit data changes
  useEffect(() => {
    if (unitData?.getUnit) {
      setSelectedUnit(unitData.getUnit);
      toast({
        title: 'Unit Found',
        description: `${unitData.getUnit.drug.medicationName} - ${unitData.getUnit.availableQuantity} available`,
      });
    }
  }, [unitData, toast]);

  // Handle getUnit errors
  useEffect(() => {
    if (unitError) {
      toast({
        title: 'Error',
        description: 'Unit not found',
        variant: 'destructive',
      });
    }
  }, [unitError, toast]);

  // Debounced fuzzy search as user types
  useEffect(() => {
    const trimmed = unitId.trim();

    // Clear search results if textbox is empty
    if (trimmed.length === 0) {
      // Clear search data by running search with empty query would return nothing
      // Or we can just not do anything and let the UI handle empty search results
      return;
    }

    const timeoutId = setTimeout(() => {
      if (trimmed.length >= 2) {
        if (unitId.length === 36) {
          getUnit({ variables: { unitId } });
        } else {
          searchUnits({ variables: { query: unitId } });
        }
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [unitId, getUnit, searchUnits]);

  const handleSelectUnit = (unit: UnitData) => {
    setUnitId(unit.unitId);
    getUnit({ variables: { unitId: unit.unitId } });
  };

  const handleCheckOut = () => {
    const qty = parseInt(quantity, 10);
    if (!selectedUnit) {
      toast({
        title: 'Error',
        description: 'Please scan or select a unit first',
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter valid quantity',
        variant: 'destructive',
      });
      return;
    }

    setPendingQty(qty);
    setIsCheckoutConfirmOpen(true);
  };

  const submitSpecificUnitCheckout = () => {
    if (!selectedUnit || pendingQty === null) return;

    if (pendingQty > selectedUnit.availableQuantity) {
      toast({
        title: 'Insufficient quantity for this unit',
        description: `Available in scanned unit: ${selectedUnit.availableQuantity}. Choose FEFO to pull across multiple units.`,
        variant: 'destructive',
      });
      return;
    }

    setIsCheckoutConfirmOpen(false);
    checkOut({
      variables: {
        input: {
          unitId: selectedUnit.unitId,
          quantity: pendingQty,
          patientName: patientName || undefined,
          patientReferenceId: patientReference || undefined,
          notes: notes || undefined,
        },
      },
    });
  };

  const submitFEFOCheckout = () => {
    if (!selectedUnit || pendingQty === null) return;

    const ndcFromSelectedUnit = selectedUnit.drug.ndcId?.trim();
    const input: Record<string, unknown> = {
      quantity: pendingQty,
      patientName: patientName || undefined,
      patientReferenceId: patientReference || undefined,
      notes: notes || undefined,
    };

    if (ndcFromSelectedUnit) {
      input.ndcId = ndcFromSelectedUnit;
    } else {
      input.medicationName = selectedUnit.drug.medicationName;
      input.strength = selectedUnit.drug.strength;
      input.strengthUnit = selectedUnit.drug.strengthUnit;
    }

    setIsCheckoutConfirmOpen(false);
    checkOutFEFO({ variables: { input } });
  };

  const handleReset = () => {
    setUnitId('');
    setSelectedUnit(null);
    setQuantity('');
    setPatientName('');
    setPatientReference('');
    setNotes('');
    setIsCheckoutConfirmOpen(false);
    setPendingQty(null);
  };

  const handleQRScanned = (code: string) => {
    setShowQRScanner(false);
    setUnitId(code);
    getUnit({ variables: { unitId: code } });
  };

  const handleViewUnitDetails = (unit: UnitData) => {
    setViewedUnit(unit);
    setShowUnitDetailsModal(true);
  };

  const handleQuarantine = (unit: UnitData, e: React.MouseEvent) => {
    e.stopPropagation();
    checkOut({
      variables: {
        input: {
          unitId: unit.unitId,
          quantity: unit.availableQuantity,
          notes: 'QUARANTINED - Removed from available inventory',
        },
      },
    });
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `DaanaRX-Label-${viewedUnit?.unitId}`,
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

  // Auto-populate unitId from URL params
  useEffect(() => {
    const unitIdParam = searchParams?.get('unitId');
    if (unitIdParam) {
      setUnitId(unitIdParam);
      getUnit({ variables: { unitId: unitIdParam } });
    }
  }, [searchParams, getUnit]);

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Check Out</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Dispense medications to patients
          </p>
        </div>

        {!loadingStats && !hasInventory && (
          <Alert className="animate-slide-in">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg">No Inventory</AlertTitle>
            <AlertDescription className="text-base">
              There are no medications in your inventory. Please check in medications before checking them out.
            </AlertDescription>
          </Alert>
        )}

        <Card className="animate-fade-in">
          <CardContent className="pt-6 space-y-5">
            <Button
              variant="outline"
              onClick={() => setShowQRScanner(true)}
              className="w-full"
              size="lg"
            >
              <QrCodeIcon className="mr-2 h-5 w-5" />
              Scan QR Code
            </Button>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-3">
                <Label htmlFor="unit-search" className="text-base font-semibold">
                  Search by Unit ID or Medication Name
                </Label>
                <Input
                  id="unit-search"
                  placeholder="Type unit ID or medication name (e.g., Lisinopril)..."
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Results appear automatically as you type (minimum 2 characters)
                </p>
              </div>
              <Button
                onClick={handleSearch}
                disabled={loadingUnit}
                size="lg"
                className="sm:mt-8 w-full sm:w-auto"
              >
                {loadingUnit && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Search
              </Button>
            </div>

            {searchingUnits && (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {!searchingUnits && unitId.trim().length >= 2 && searchData?.searchUnitsByQuery && searchData.searchUnitsByQuery.length > 0 && (
              <Card className="animate-slide-in">
                <CardHeader>
                  <CardTitle className="text-xl">Search Results ({searchData.searchUnitsByQuery.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-1">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Medication</TableHead>
                          <TableHead className="font-semibold">Strength</TableHead>
                          <TableHead className="font-semibold">Available</TableHead>
                          <TableHead className="font-semibold">Expiry</TableHead>
                          <TableHead className="font-semibold">Location</TableHead>
                          <TableHead className="font-semibold">Source</TableHead>
                          <TableHead className="w-[60px] font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchData.searchUnitsByQuery.map((unit: UnitData) => {
                          const isExpired = new Date(unit.expiryDate) < new Date();
                          const isExpiringSoon = new Date(unit.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                          return (
                            <TableRow
                              key={unit.unitId}
                              onClick={() => handleViewUnitDetails(unit)}
                              className="cursor-pointer hover:bg-accent/50 transition-colors"
                            >
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-semibold">{unit.drug.medicationName}</div>
                                  <div className="text-sm text-muted-foreground">{unit.drug.genericName}</div>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {unit.drug.strength} {unit.drug.strengthUnit}
                              </TableCell>
                              <TableCell>
                                <Badge variant={unit.availableQuantity > 0 ? 'default' : 'secondary'} className="px-3 py-1">
                                  {unit.availableQuantity} / {unit.totalQuantity}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={isExpired ? 'destructive' : isExpiringSoon ? 'outline' : 'secondary'}
                                  className={cn(
                                    'px-3 py-1',
                                    !isExpired && isExpiringSoon && 'border-warning/50 text-warning bg-warning/5'
                                  )}
                                >
                                  {new Date(unit.expiryDate).toLocaleDateString()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {unit.lot?.location ? (
                                  <Badge variant="outline" className="px-3 py-1">
                                    {unit.lot.location.name}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-medium">{unit.lot?.source || '-'}</span>
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                      <span className="sr-only">Actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectUnit(unit);
                                      }}
                                      disabled={unit.availableQuantity === 0}
                                    >
                                      <ShoppingCart className="mr-2 h-4 w-4" />
                                      Select for Checkout
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewUnitDetails(unit);
                                      }}
                                    >
                                      <QrCodeIconAlt className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={(e) => handleQuarantine(unit, e as any)}
                                      disabled={unit.availableQuantity === 0}
                                      className="text-orange-600"
                                    >
                                      <AlertTriangle className="mr-2 h-4 w-4" />
                                      Quarantine
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {!searchingUnits && unitId.trim().length >= 2 && searchData?.searchUnitsByQuery && searchData.searchUnitsByQuery.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No units found matching "{unitId}". Try a different search term or scan a QR code.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {selectedUnit && (
          <Card className="animate-fade-in">
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-2xl sm:text-3xl font-bold">Unit Details</h3>
                <Badge
                  variant={selectedUnit.availableQuantity > 0 ? 'default' : 'destructive'}
                  className="text-base sm:text-lg px-4 py-2"
                >
                  {selectedUnit.availableQuantity} Available
                </Badge>
              </div>

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-5 space-y-3">
                  <h4 className="text-xl font-bold">{selectedUnit.drug.medicationName}</h4>
                  <p className="text-base text-muted-foreground">
                    Generic: {selectedUnit.drug.genericName}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Strength:</span>
                    <Badge variant="outline">
                      {selectedUnit.drug.strength} {selectedUnit.drug.strengthUnit}
                    </Badge>
                  </div>
                  <p className="text-base"><span className="font-semibold">Form:</span> {selectedUnit.drug.form}</p>
                  {selectedUnit.drug.ndcId && (
                    <p className="text-sm font-mono"><span className="font-semibold">NDC:</span> {selectedUnit.drug.ndcId}</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Quantity</p>
                  <Badge variant="secondary" className="text-base px-4 py-2">
                    {selectedUnit.totalQuantity}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Expiry Date</p>
                  <Badge
                    variant={new Date(selectedUnit.expiryDate) < new Date() ? 'destructive' : 'secondary'}
                    className="text-base px-4 py-2"
                  >
                    {new Date(selectedUnit.expiryDate).toLocaleDateString()}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Source</p>
                  <p className="font-bold text-base">{selectedUnit.lot?.source}</p>
                </div>
              </div>

                  {selectedUnit.optionalNotes && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{selectedUnit.optionalNotes}</p>
                    </div>
                  )}

              <div className="pt-6 border-t">
                <h4 className="text-xl sm:text-2xl font-bold mb-6">Dispense Medication</h4>

                <div className="space-y-5">
                  <div className="space-y-3">
                    <Label htmlFor="quantity" className="text-base font-semibold">Quantity to Dispense *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      placeholder="Enter quantity"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="patient-name" className="text-base font-semibold">Patient Name (Optional)</Label>
                    <Input
                      id="patient-name"
                      placeholder="Enter patient or recipient name"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="patient-ref" className="text-base font-semibold">Patient Reference ID (Optional)</Label>
                    <Input
                      id="patient-ref"
                      placeholder="Patient identifier or code"
                      value={patientReference}
                      onChange={(e) => setPatientReference(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="checkout-notes" className="text-base font-semibold">Notes (Optional)</Label>
                    <Textarea
                      id="checkout-notes"
                      placeholder="Any additional notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button 
                      onClick={handleCheckOut} 
                      disabled={checkingOut || checkingOutFEFO} 
                      className="w-full sm:w-auto" 
                      size="lg"
                    >
                      {(checkingOut || checkingOutFEFO) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Check Out
                    </Button>
                    <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto" size="lg">
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isCheckoutConfirmOpen} onOpenChange={setIsCheckoutConfirmOpen}>
          <DialogContent className="sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle>Choose checkout method</DialogTitle>
              <DialogDescription>
                {selectedUnit && pendingQty !== null
                  ? `You're dispensing ${pendingQty} of ${selectedUnit.drug.medicationName} (${selectedUnit.drug.strength} ${selectedUnit.drug.strengthUnit}).`
                  : 'Select how you want to dispense this medication.'}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {selectedUnit && pendingQty !== null && pendingQty > selectedUnit.availableQuantity && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Quantity exceeds scanned unit</AlertTitle>
                  <AlertDescription>
                    This unit only has {selectedUnit.availableQuantity} available. FEFO can pull the remaining quantity from other matching units (earliest expiry first).
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2 sm:space-x-0">
              <Button
                variant="outline"
                onClick={() => setIsCheckoutConfirmOpen(false)}
                disabled={checkingOut || checkingOutFEFO}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={submitSpecificUnitCheckout}
                disabled={checkingOut || checkingOutFEFO}
                className="w-full sm:w-auto"
              >
                Use scanned unit only
              </Button>
              <Button
                onClick={submitFEFOCheckout}
                disabled={checkingOut || checkingOutFEFO}
                className="w-full sm:w-auto"
              >
                Use FEFO (recommended)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unit Details Modal */}
        <Dialog open={showUnitDetailsModal} onOpenChange={setShowUnitDetailsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Unit Details</DialogTitle>
            </DialogHeader>
            {viewedUnit && (
              <div className="space-y-6">
                {/* QR Code Section with Print */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">QR Code</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrint()}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print Label
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <div ref={printRef}>
                      <UnitLabel
                        unitId={viewedUnit.unitId}
                        medicationName={viewedUnit.drug.medicationName}
                        genericName={viewedUnit.drug.genericName}
                        strength={viewedUnit.drug.strength}
                        strengthUnit={viewedUnit.drug.strengthUnit}
                        form={viewedUnit.drug.form}
                        ndcId={viewedUnit.drug.ndcId}
                        manufacturerLotNumber={viewedUnit.manufacturerLotNumber}
                        availableQuantity={viewedUnit.availableQuantity}
                        totalQuantity={viewedUnit.totalQuantity}
                        expiryDate={viewedUnit.expiryDate}
                        donationSource={viewedUnit.lot?.source}
                        locationName={viewedUnit.lot?.location?.name}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Unit Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Medication Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Medication:</p>
                        <p className="text-sm text-muted-foreground">{viewedUnit.drug.medicationName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Generic:</p>
                        <p className="text-sm text-muted-foreground">{viewedUnit.drug.genericName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Strength:</p>
                        <Badge variant="outline">
                          {viewedUnit.drug.strength} {viewedUnit.drug.strengthUnit}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Form:</p>
                        <p className="text-sm text-muted-foreground">{viewedUnit.drug.form}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">NDC:</p>
                        <p className="text-sm font-mono text-muted-foreground">{viewedUnit.drug.ndcId}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Available / Total:</p>
                        <Badge variant={viewedUnit.availableQuantity > 0 ? 'default' : 'secondary'}>
                          {viewedUnit.availableQuantity} / {viewedUnit.totalQuantity}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Expiry Date:</p>
                        <p className="text-sm text-muted-foreground">{new Date(viewedUnit.expiryDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Manufacturer Lot #:</p>
                        {viewedUnit.manufacturerLotNumber ? (
                          <Badge variant="outline" className="font-mono">
                            {viewedUnit.manufacturerLotNumber}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            NOT RECORDED
                          </Badge>
                        )}
                      </div>
                      {viewedUnit.lot && (
                        <>
                          <div>
                            <p className="text-sm font-medium">Donation Source:</p>
                            <p className="text-sm text-muted-foreground">{viewedUnit.lot.source}</p>
                          </div>
                          {viewedUnit.lot.location && (
                            <div>
                              <p className="text-sm font-medium">Location:</p>
                              <Badge variant="outline">
                                {viewedUnit.lot.location.name} ({viewedUnit.lot.location.temp.replace('_', ' ')})
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {viewedUnit.optionalNotes && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <p className="text-sm font-medium mb-2">Notes:</p>
                          <p className="text-sm text-muted-foreground">{viewedUnit.optionalNotes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => {
                          setShowUnitDetailsModal(false);
                          handleSelectUnit(viewedUnit);
                        }}
                        disabled={viewedUnit.availableQuantity === 0}
                        size="lg"
                        className="w-full sm:w-auto"
                      >
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Select for Checkout
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowUnitDetailsModal(false);
                          handleQuarantine(viewedUnit, { stopPropagation: () => {} } as React.MouseEvent);
                        }}
                        disabled={viewedUnit.availableQuantity === 0}
                        size="lg"
                        className="w-full sm:w-auto border-warning text-warning hover:bg-warning/10"
                      >
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Quarantine All
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <QRScanner
          opened={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScanned}
          title="Scan DaanaRX QR Code"
          description="Scan the QR code on the medication unit to check it out"
        />
      </div>
    </AppShell>
  );
}

export default function CheckOutPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <CheckOutContent />
    </Suspense>
  );
}
