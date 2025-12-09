'use client';

import { useState, useRef } from 'react';
import { useQuery, useLazyQuery, useMutation, gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
import {
  MoreVertical,
  ShoppingCart,
  AlertTriangle,
  QrCode as QrCodeIcon,
  Printer,
  Info,
  Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';
import { AppShell } from '../../components/layout/AppShell';
import { TransactionData, GetLocationsResponse, LocationData, DrugData } from '../../types/graphql';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const GET_UNITS = gql`
  query GetUnits($page: Int, $pageSize: Int, $search: String) {
    getUnits(page: $page, pageSize: $pageSize, search: $search) {
      units {
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
      total
      page
      pageSize
    }
  }
`;

const GET_LOCATIONS = gql`
  query GetLocations {
    getLocations {
      locationId
      name
      temp
    }
  }
`;

const GET_TRANSACTIONS = gql`
  query GetTransactions($unitId: ID!) {
    getTransactions(unitId: $unitId, page: 1, pageSize: 20) {
      transactions {
        transactionId
        timestamp
        type
        quantity
        notes
        patientName
        patientReferenceId
        user {
          username
        }
      }
    }
  }
`;

const CHECK_OUT_UNIT = gql`
  mutation CheckOutUnit($input: CheckOutInput!) {
    checkOutUnit(input: $input) {
      transactionId
      quantity
    }
  }
`;

// Unit data with location info
interface UnitDataWithLocation {
  unitId: string;
  totalQuantity: number;
  availableQuantity: number;
  expiryDate: string;
  optionalNotes?: string | null;
  drug: DrugData;
  lot?: {
    source: string;
    location?: {
      locationId: string;
      name: string;
      temp: string;
    };
  };
}

interface TransactionWithUser extends TransactionData {
  user?: {
    username: string;
  };
  patientName?: string | null;
}

export default function InventoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<UnitDataWithLocation | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [quickCheckoutUnit, setQuickCheckoutUnit] = useState<UnitDataWithLocation | null>(null);
  const [checkoutQuantity, setCheckoutQuantity] = useState('1');
  const [checkoutModalOpened, setCheckoutModalOpened] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);

  // Combine search text with filters
  const getSearchQuery = () => {
    let query = search;
    if (filterType !== 'all') {
      query = query ? `${query} ${filterType}` : filterType;
    }
    if (filterLocation !== 'all') {
      query = query ? `${query} ${filterLocation}` : filterLocation;
    }
    return query || undefined;
  };

  const { data, loading, refetch } = useQuery<{ getUnits: { units: UnitDataWithLocation[]; total: number; page: number; pageSize: number } }>(GET_UNITS, {
    variables: { page, pageSize: 20, search: getSearchQuery() },
  });

  const { data: locationsData } = useQuery<GetLocationsResponse>(GET_LOCATIONS);

  const [getTransactions, { data: transactionsData, loading: loadingTransactions }] =
    useLazyQuery<{ getTransactions: { transactions: TransactionWithUser[] } }>(GET_TRANSACTIONS);

  const [checkOutUnit, { loading: checkingOut }] = useMutation(CHECK_OUT_UNIT, {
    onCompleted: () => {
      toast({
        title: 'Success',
        description: 'Unit checked out successfully',
      });
      setCheckoutModalOpened(false);
      setQuickCheckoutUnit(null);
      setCheckoutQuantity('1');
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const totalPages = data ? Math.ceil(data.getUnits.total / data.getUnits.pageSize) : 0;

  // Filter units by location
  const filteredUnits = data?.getUnits.units.filter((unit) => {
    if (filterLocation === 'all') return true;
    return unit.lot?.location?.locationId === filterLocation;
  }) || [];

  const handleRowClick = (unit: UnitDataWithLocation) => {
    setSelectedUnit(unit);
    setModalOpened(true);
    getTransactions({ variables: { unitId: unit.unitId } });
  };

  const handleCloseModal = () => {
    setModalOpened(false);
    setSelectedUnit(null);
  };

  const handleQuickCheckout = (unit: UnitDataWithLocation, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickCheckoutUnit(unit);
    setCheckoutModalOpened(true);
  };

  const handleQuickCheckoutSubmit = () => {
    if (!quickCheckoutUnit) return;
    
    const qty = parseInt(checkoutQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    if (qty > quickCheckoutUnit.availableQuantity) {
      toast({
        title: 'Error',
        description: 'Quantity exceeds available stock',
        variant: 'destructive',
      });
      return;
    }

    checkOutUnit({
      variables: {
        input: {
          unitId: quickCheckoutUnit.unitId,
          quantity: qty,
          notes: 'Quick checkout from inventory',
        },
      },
    });
  };

  const handleQuarantine = (unit: UnitDataWithLocation, e: React.MouseEvent) => {
    e.stopPropagation();
    // Quarantine is essentially checking out all available quantity with a note
    checkOutUnit({
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
    documentTitle: `DaanaRX-Label-${selectedUnit?.unitId}`,
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

  const locationOptions = locationsData?.getLocations || [];

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Inventory</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            View and manage all medication units
          </p>
        </div>

        <Card className="animate-fade-in">
          <CardContent className="pt-6 space-y-5">
            <Alert className="border-primary/20 bg-primary/5">
              <Info className="h-5 w-5 text-primary" />
              <AlertDescription className="text-base">
                Click on any row to view unit details, QR code, and transaction history. Use the action menu (⋮) for quick checkout or quarantine.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Label htmlFor="inventory-search" className="text-base font-semibold">Search Inventory</Label>
              <Input
                id="inventory-search"
                placeholder="Search by medication, NDC, source, lot, quantity, or notes..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
              <div className="flex-1 space-y-3">
                <Label className="text-base font-semibold">Filter by Form</Label>
                <div className="flex flex-wrap gap-2">
                  {['all', 'tablet', 'capsule', 'liquid', 'injection'].map((type) => (
                    <Button
                      key={type}
                      variant={filterType === type ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setFilterType(type);
                        setPage(1);
                      }}
                      className="capitalize"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="w-full lg:w-[240px] space-y-3">
                <Label htmlFor="location-filter" className="text-base font-semibold">Filter by Location</Label>
                <Select value={filterLocation} onValueChange={(value) => {
                  setFilterLocation(value);
                  setPage(1);
                }}>
                  <SelectTrigger id="location-filter">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locationOptions.map((loc: LocationData) => (
                      <SelectItem key={loc.locationId} value={loc.locationId}>
                        {loc.name} ({loc.temp.replace('_', ' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>

          {loading && !data ? (
            <div className="flex justify-center items-center h-[300px]">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : filteredUnits.length > 0 ? (
            <>
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
                    {filteredUnits.map((unit) => {
                      const isExpired = new Date(unit.expiryDate) < new Date();
                      const isExpiringSoon =
                        new Date(unit.expiryDate) <
                        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                      return (
                        <TableRow
                          key={unit.unitId}
                          onClick={() => handleRowClick(unit)}
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
                                  onClick={(e) => handleQuickCheckout(unit, e as any)}
                                  disabled={unit.availableQuantity === 0}
                                >
                                  <ShoppingCart className="mr-2 h-4 w-4" />
                                  Quick Checkout
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(unit);
                                  }}
                                >
                                  <QrCodeIcon className="mr-2 h-4 w-4" />
                                  View QR Code
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

              {totalPages > 1 && (
                <div className="flex justify-center py-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setPage(Math.max(1, page - 1))}
                          className={cn(page === 1 && 'pointer-events-none opacity-50')}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => setPage(pageNum)}
                              isActive={page === pageNum}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          className={cn(page === totalPages && 'pointer-events-none opacity-50')}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No units found
            </div>
          )}
        </Card>

        {/* Unit Details Modal */}
        <Dialog open={modalOpened} onOpenChange={handleCloseModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Unit Details</DialogTitle>
            </DialogHeader>
            {selectedUnit && (
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
                      <div style={{ 
                        display: 'flex', 
                        border: '1px solid #ddd', 
                        padding: '12px',
                        backgroundColor: 'white',
                        fontFamily: 'Arial, sans-serif',
                        width: '384px',
                        height: '192px',
                        boxSizing: 'border-box',
                      }}>
                        {/* QR Code - Left Side */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingRight: '12px',
                          borderRight: '1px solid #ddd',
                          minWidth: '130px',
                        }}>
                          <QRCodeSVG value={selectedUnit.unitId} size={100} level="H" />
                          <div style={{ fontSize: '6px', marginTop: '4px', textAlign: 'center', wordBreak: 'break-all', maxWidth: '100px', lineHeight: 1.2 }}>
                            {selectedUnit.unitId}
                          </div>
                        </div>
                        
                        {/* Label Information - Right Side */}
                        <div style={{ 
                          flex: 1, 
                          paddingLeft: '12px',
                          fontSize: '9px',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: 1.1, marginBottom: '1px' }}>
                            {selectedUnit.drug.medicationName}
                          </div>
                          <div style={{ fontSize: '9px', color: '#666', marginBottom: '3px' }}>
                            ({selectedUnit.drug.genericName})
                          </div>
                          
                          <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '3px' }}>
                            {selectedUnit.drug.strength} {selectedUnit.drug.strengthUnit} - {selectedUnit.drug.form}
                          </div>
                          
                          <div style={{ marginBottom: '2px' }}>
                            <span style={{ fontWeight: '600' }}>NDC: </span>
                            {selectedUnit.drug.ndcId}
                          </div>
                          
                          <div style={{ marginBottom: '2px' }}>
                            <span style={{ fontWeight: '600' }}>Qty: </span>
                            {selectedUnit.availableQuantity} / {selectedUnit.totalQuantity}
                          </div>
                          
                          <div style={{ marginBottom: '2px' }}>
                            <span style={{ fontWeight: '600' }}>EXP: </span>
                            {new Date(selectedUnit.expiryDate).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' })}
                          </div>
                          
                          <div style={{ marginBottom: '2px' }}>
                            <span style={{ fontWeight: '600' }}>LOT: </span>
                            {selectedUnit.lot?.source || 'N/A'}
                          </div>
                          
                          {selectedUnit.lot?.location && (
                            <div style={{ fontSize: '8px', color: '#666' }}>
                              Store: {selectedUnit.lot.location.name}
                            </div>
                          )}
                          
                          <div style={{ 
                            fontSize: '7px', 
                            color: '#888', 
                            marginTop: 'auto',
                            borderTop: '1px solid #eee',
                            paddingTop: '2px',
                          }}>
                            DaanaRX • For Clinic Use Only
                          </div>
                        </div>
                      </div>
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
                        <p className="text-sm text-muted-foreground">{selectedUnit.drug.medicationName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Generic:</p>
                        <p className="text-sm text-muted-foreground">{selectedUnit.drug.genericName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Strength:</p>
                        <Badge variant="outline">
                          {selectedUnit.drug.strength} {selectedUnit.drug.strengthUnit}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Form:</p>
                        <p className="text-sm text-muted-foreground">{selectedUnit.drug.form}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">NDC:</p>
                        <p className="text-sm font-mono text-muted-foreground">{selectedUnit.drug.ndcId}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Available / Total:</p>
                        <Badge variant={selectedUnit.availableQuantity > 0 ? 'default' : 'secondary'}>
                          {selectedUnit.availableQuantity} / {selectedUnit.totalQuantity}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Expiry Date:</p>
                        <p className="text-sm text-muted-foreground">{new Date(selectedUnit.expiryDate).toLocaleDateString()}</p>
                      </div>
                      {selectedUnit.lot && (
                        <>
                          <div>
                            <p className="text-sm font-medium">Source:</p>
                            <p className="text-sm text-muted-foreground">{selectedUnit.lot.source}</p>
                          </div>
                          {selectedUnit.lot.location && (
                            <div>
                              <p className="text-sm font-medium">Location:</p>
                              <Badge variant="outline">
                                {selectedUnit.lot.location.name} ({selectedUnit.lot.location.temp.replace('_', ' ')})
                              </Badge>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {selectedUnit.optionalNotes && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <p className="text-sm font-medium mb-2">Notes:</p>
                          <p className="text-sm text-muted-foreground">{selectedUnit.optionalNotes}</p>
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
                        onClick={() => router.push(`/checkout?unitId=${selectedUnit.unitId}`)}
                        disabled={selectedUnit.availableQuantity === 0}
                        size="lg"
                        className="w-full sm:w-auto"
                      >
                        <ShoppingCart className="mr-2 h-5 w-5" />
                        Checkout
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleCloseModal();
                          handleQuarantine(selectedUnit, { stopPropagation: () => {} } as React.MouseEvent);
                        }}
                        disabled={selectedUnit.availableQuantity === 0}
                        size="lg"
                        className="w-full sm:w-auto border-warning text-warning hover:bg-warning/10"
                      >
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Quarantine All
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Transaction History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Transaction History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingTransactions ? (
                      <div className="flex justify-center items-center h-[100px]">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : transactionsData?.getTransactions.transactions &&
                      transactionsData.getTransactions.transactions.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactionsData.getTransactions.transactions.map((tx) => (
                            <TableRow key={tx.transactionId}>
                              <TableCell className="text-sm">{new Date(tx.timestamp).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge variant={tx.type === 'check_in' ? 'default' : tx.type === 'check_out' ? 'secondary' : 'outline'}>
                                  {tx.type.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell>{tx.quantity}</TableCell>
                              <TableCell className="text-sm">{tx.user?.username || '-'}</TableCell>
                              <TableCell className="text-sm">{tx.notes || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No transactions found</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Quick Checkout Modal */}
        <Dialog open={checkoutModalOpened} onOpenChange={setCheckoutModalOpened}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Quick Checkout</DialogTitle>
            </DialogHeader>
            {quickCheckoutUnit && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="font-medium">{quickCheckoutUnit.drug.medicationName}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Available:</span>
                    <Badge>{quickCheckoutUnit.availableQuantity}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkout-qty">Quantity to checkout</Label>
                  <Input
                    id="checkout-qty"
                    type="number"
                    min={1}
                    max={quickCheckoutUnit.availableQuantity}
                    value={checkoutQuantity}
                    onChange={(e) => setCheckoutQuantity(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCheckoutModalOpened(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleQuickCheckoutSubmit} disabled={checkingOut}>
                    {checkingOut && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Checkout
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
