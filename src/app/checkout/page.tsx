'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLazyQuery, useMutation, useQuery, gql } from '@apollo/client';
import { QrCodeIcon, AlertCircle, Loader2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { QRScanner } from '../../components/QRScanner';
import { GetUnitResponse, SearchUnitsResponse, UnitData } from '../../types/graphql';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const GET_UNIT = gql`
  query GetUnit($unitId: ID!) {
    getUnit(unitId: $unitId) {
      unitId
      totalQuantity
      availableQuantity
      expiryDate
      optionalNotes
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
      }
    }
  }
`;

const SEARCH_UNITS = gql`
  query SearchUnits($query: String!) {
    searchUnitsByQuery(query: $query) {
      unitId
      availableQuantity
      expiryDate
      drug {
        medicationName
        genericName
        strength
        strengthUnit
      }
    }
  }
`;

const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    getDashboardStats {
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

  // Check if inventory is empty
  const { data: dashboardData, loading: loadingStats } = useQuery(GET_DASHBOARD_STATS);
  const hasInventory = dashboardData?.getDashboardStats?.totalUnits > 0;

  const [getUnit, { loading: loadingUnit }] = useLazyQuery<GetUnitResponse>(GET_UNIT, {
    onCompleted: (data) => {
      if (data.getUnit) {
        setSelectedUnit(data.getUnit);
        toast({
          title: 'Unit Found',
          description: `${data.getUnit.drug.medicationName} - ${data.getUnit.availableQuantity} available`,
        });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Unit not found',
        variant: 'destructive',
      });
    },
  });

  const [searchUnits, { data: searchData }] = useLazyQuery<SearchUnitsResponse>(SEARCH_UNITS);

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

  const handleSearch = () => {
    if (unitId.length >= 3) {
      if (unitId.length === 36) {
        // Full UUID
        getUnit({ variables: { unitId } });
      } else {
        // Partial search
        searchUnits({ variables: { query: unitId } });
      }
    }
  };

  const handleSelectUnit = (unit: UnitData) => {
    setUnitId(unit.unitId);
    getUnit({ variables: { unitId: unit.unitId } });
  };

  const handleCheckOut = () => {
    const qty = parseInt(quantity, 10);
    if (!selectedUnit || isNaN(qty) || qty <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter valid quantity',
        variant: 'destructive',
      });
      return;
    }

    if (qty > selectedUnit.availableQuantity) {
      toast({
        title: 'Error',
        description: `Insufficient quantity. Available: ${selectedUnit.availableQuantity}`,
        variant: 'destructive',
      });
      return;
    }

    checkOut({
      variables: {
        input: {
          unitId: selectedUnit.unitId,
          quantity: qty,
          patientName: patientName || undefined,
          patientReferenceId: patientReference || undefined,
          notes: notes || undefined,
        },
      },
    });
  };

  const handleReset = () => {
    setUnitId('');
    setSelectedUnit(null);
    setQuantity('');
    setPatientName('');
    setPatientReference('');
    setNotes('');
  };

  const handleQRScanned = (code: string) => {
    setShowQRScanner(false);
    setUnitId(code);
    getUnit({ variables: { unitId: code } });
  };

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
                <Label htmlFor="unit-search" className="text-base font-semibold">Search by Unit ID, Generic Name, or Strength</Label>
                <Input
                  id="unit-search"
                  placeholder="Enter unit ID, generic name (e.g., Lisinopril), or strength (e.g., 10)"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Search by unit ID, medication generic name, or strength value
                </p>
              </div>
              <Button onClick={handleSearch} disabled={loadingUnit} size="lg" className="sm:mt-8 w-full sm:w-auto">
                {loadingUnit && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                Search
              </Button>
            </div>

            {searchData?.searchUnitsByQuery && searchData.searchUnitsByQuery.length > 0 && (
              <Card className="animate-slide-in">
                <CardHeader>
                  <CardTitle className="text-xl">Search Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-1">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Medication</TableHead>
                          <TableHead className="font-semibold">Generic Name</TableHead>
                          <TableHead className="font-semibold">Strength</TableHead>
                          <TableHead className="font-semibold">Available</TableHead>
                          <TableHead className="font-semibold">Expiry</TableHead>
                          <TableHead className="font-semibold">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchData.searchUnitsByQuery.map((unit: UnitData) => (
                          <TableRow key={unit.unitId} className="hover:bg-accent/50">
                            <TableCell className="font-semibold">{unit.drug.medicationName}</TableCell>
                            <TableCell>{unit.drug.genericName}</TableCell>
                            <TableCell>
                              {unit.drug.strength} {unit.drug.strengthUnit}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{unit.availableQuantity}</Badge>
                            </TableCell>
                            <TableCell>{new Date(unit.expiryDate).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button size="sm" onClick={() => handleSelectUnit(unit)}>
                                Select
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {selectedUnit && (
          <Card className="animate-fade-in">
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-2xl sm:text-3xl font-bold">Unit Details</h3>
                <Badge variant={selectedUnit.availableQuantity > 0 ? 'default' : 'destructive'} className="text-base sm:text-lg px-4 py-2">
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
                      max={selectedUnit.availableQuantity}
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
                    <Button onClick={handleCheckOut} disabled={checkingOut} className="w-full sm:w-auto" size="lg">
                      {checkingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
