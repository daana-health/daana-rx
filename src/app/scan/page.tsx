'use client';

import { useState } from 'react';
import { useLazyQuery, gql } from '@apollo/client';
import { QrCodeIcon, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../components/layout/AppShell';
import { QRScanner } from '../../components/QRScanner';
import { GetUnitResponse, GetTransactionsResponse, SearchUnitsResponse, UnitData, TransactionData } from '../../types/graphql';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
      }
      lot {
        source
      }
    }
  }
`;

const GET_TRANSACTIONS = gql`
  query GetTransactions($unitId: ID!) {
    getTransactions(unitId: $unitId, page: 1, pageSize: 10) {
      transactions {
        transactionId
        timestamp
        type
        quantity
        notes
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
      }
    }
  }
`;

export default function ScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [unitId, setUnitId] = useState('');
  const [unit, setUnit] = useState<UnitData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const [getUnit] = useLazyQuery<GetUnitResponse>(GET_UNIT, {
    onCompleted: (data) => {
      if (data.getUnit) {
        setUnit(data.getUnit);
        getTransactions({ variables: { unitId: data.getUnit.unitId } });
        toast({
          title: 'Unit Found',
          description: `${data.getUnit.drug.medicationName}`,
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

  const [getTransactions] = useLazyQuery<GetTransactionsResponse>(GET_TRANSACTIONS, {
    onCompleted: (data) => {
      setTransactions(data.getTransactions.transactions);
    },
  });

  const [searchUnits, { data: searchData }] = useLazyQuery<SearchUnitsResponse>(SEARCH_UNITS);

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

  const handleSelectUnit = (selectedUnit: UnitData) => {
    setUnitId(selectedUnit.unitId);
    getUnit({ variables: { unitId: selectedUnit.unitId } });
  };

  const handleClear = () => {
    setUnitId('');
    setUnit(null);
    setTransactions([]);
  };

  const handleQRScanned = (code: string) => {
    setShowQRScanner(false);
    setUnitId(code);
    getUnit({ variables: { unitId: code } });
  };

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Scan / Lookup</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Quick access to unit information
          </p>
        </div>

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

            <div className="space-y-3">
              <Label htmlFor="unit-id" className="text-base font-semibold">Unit ID or Search</Label>
              <div className="flex gap-2">
                <Input
                  id="unit-id"
                  placeholder="Enter unit ID or search"
                  value={unitId}
                  onChange={(e) => {
                    setUnitId(e.target.value);
                    if (e.target.value.length >= 3) {
                      handleSearch();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="flex-1"
                />
                {unitId && (
                  <Button size="icon" variant="ghost" onClick={handleClear}>
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>

            {searchData?.searchUnitsByQuery && searchData.searchUnitsByQuery.length > 0 && !unit && (
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
                          <TableHead className="font-semibold">Available</TableHead>
                          <TableHead className="font-semibold">Expiry</TableHead>
                          <TableHead className="font-semibold">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchData.searchUnitsByQuery.map((searchUnit: UnitData) => (
                          <TableRow key={searchUnit.unitId} className="hover:bg-accent/50">
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-semibold">{searchUnit.drug.medicationName}</p>
                                <p className="text-sm text-muted-foreground">{searchUnit.drug.genericName}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={searchUnit.availableQuantity > 0 ? 'default' : 'destructive'} className="px-3 py-1">
                                {searchUnit.availableQuantity}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(searchUnit.expiryDate).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button size="sm" onClick={() => handleSelectUnit(searchUnit)}>
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

        {unit && (
          <>
            <Card className="animate-fade-in">
              <CardContent className="pt-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h3 className="text-2xl sm:text-3xl font-bold">{unit.drug.medicationName}</h3>
                  <Badge variant={unit.availableQuantity > 0 ? 'default' : 'destructive'} className="text-base sm:text-lg px-4 py-2">
                    {unit.availableQuantity} / {unit.totalQuantity}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Generic Name</p>
                    <p className="font-bold text-base">{unit.drug.genericName}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Strength</p>
                    <Badge variant="outline" className="px-3 py-1">
                      {unit.drug.strength} {unit.drug.strengthUnit}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Form</p>
                    <p className="font-bold text-base">{unit.drug.form}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Source</p>
                    <p className="font-bold text-base">{unit.lot?.source}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Expiry Date</p>
                    <Badge
                      variant={new Date(unit.expiryDate) < new Date() ? 'destructive' : 'secondary'}
                      className="px-3 py-1"
                    >
                      {new Date(unit.expiryDate).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>

                {unit.optionalNotes && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notes</p>
                    <p className="text-base">{unit.optionalNotes}</p>
                  </div>
                )}

                <Button
                  onClick={() => router.push(`/checkout?unitId=${unit.unitId}`)}
                  disabled={unit.availableQuantity === 0}
                  className="w-full"
                  size="lg"
                >
                  Quick Check-Out
                </Button>
              </CardContent>
            </Card>

            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle className="text-2xl">Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length > 0 ? (
                  <div className="overflow-x-auto -mx-1">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Date</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold">Quantity</TableHead>
                          <TableHead className="font-semibold">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx: TransactionData) => (
                          <TableRow key={tx.transactionId} className="hover:bg-accent/50">
                            <TableCell className="text-sm">{new Date(tx.timestamp).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={tx.type === 'check_in' ? 'default' : 'secondary'} className="px-3 py-1">
                                {tx.type.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{tx.quantity}</TableCell>
                            <TableCell className="text-sm">{tx.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-base text-muted-foreground text-center py-8">No transactions yet</p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <QRScanner
          opened={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScanned}
          title="Scan DaanaRX QR Code"
          description="Scan the QR code on the medication unit to look it up"
        />
      </div>
    </AppShell>
  );
}
