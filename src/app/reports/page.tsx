'use client';

import { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { Info, Loader2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const GET_TRANSACTIONS = gql`
  query GetTransactions($page: Int, $pageSize: Int, $search: String) {
    getTransactions(page: $page, pageSize: $pageSize, search: $search) {
      transactions {
        transactionId
        timestamp
        type
        quantity
        notes
        patientName
        patientReferenceId
        user {
          userId
          username
        }
        unit {
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
              name
              temp
            }
          }
        }
      }
      total
      page
      pageSize
    }
  }
`;

interface TransactionWithDetails {
  transactionId: string;
  timestamp: string;
  type: 'check_in' | 'check_out' | 'adjust';
  quantity: number;
  notes?: string | null;
  patientName?: string | null;
  patientReferenceId?: string | null;
  user?: {
    userId: string;
    username: string;
  } | null;
  unit?: {
    unitId: string;
    totalQuantity: number;
    availableQuantity: number;
    expiryDate: string;
    optionalNotes?: string | null;
    drug: {
      medicationName: string;
      genericName: string;
      strength: number;
      strengthUnit: string;
      ndcId: string;
      form: string;
    };
    lot?: {
      source: string;
      location?: {
        name: string;
        temp: string;
      };
    };
  };
}

interface GetTransactionsResponse {
  getTransactions: {
    transactions: TransactionWithDetails[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export default function ReportsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  const { data, loading } = useQuery<GetTransactionsResponse>(GET_TRANSACTIONS, {
    variables: { page, pageSize: 20, search: search || undefined },
  });

  const totalPages = data
    ? Math.ceil(data.getTransactions.total / data.getTransactions.pageSize)
    : 0;

  const handleRowClick = (tx: TransactionWithDetails) => {
    setSelectedTransaction(tx);
    setModalOpened(true);
  };

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    return type === 'check_in' ? 'default' : type === 'check_out' ? 'secondary' : 'outline';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Reports</h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Transaction logs and audit trail
          </p>
        </div>

        <Card className="animate-fade-in">
          <CardContent className="pt-6 space-y-5">
            <Alert className="border-primary/20 bg-primary/5">
              <Info className="h-5 w-5 text-primary" />
              <AlertDescription className="text-base">
                Click on any row to view full transaction details, medication information, and timestamps.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Input
                placeholder="Search transactions (medication, user, type, quantity, notes, patient ref...)"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </CardContent>

          {loading ? (
            <div className="flex justify-center items-center h-[300px]">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : data?.getTransactions.transactions && data.getTransactions.transactions.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Date & Time</TableHead>
                      <TableHead className="font-semibold">Medication</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Quantity</TableHead>
                      <TableHead className="font-semibold">User</TableHead>
                      <TableHead className="font-semibold">Patient</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.getTransactions.transactions.map((tx) => (
                      <TableRow
                        key={tx.transactionId}
                        onClick={() => handleRowClick(tx)}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                      >
                        <TableCell className="text-sm font-medium">{formatDate(tx.timestamp)}</TableCell>
                        <TableCell>
                          {tx.unit?.drug ? (
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">{tx.unit.drug.medicationName}</p>
                              <p className="text-sm text-muted-foreground">
                                {tx.unit.drug.strength} {tx.unit.drug.strengthUnit} - {tx.unit.drug.form}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTypeBadgeVariant(tx.type)} className="px-3 py-1 capitalize">
                            {tx.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'px-3 py-1 font-semibold',
                              tx.type === 'check_out' && 'border-destructive/50 text-destructive bg-destructive/5',
                              tx.type === 'check_in' && 'border-success/50 text-success bg-success/5'
                            )}
                          >
                            {tx.type === 'check_out' ? `-${tx.quantity}` : `+${tx.quantity}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{tx.user?.username || '-'}</TableCell>
                        <TableCell>
                          {tx.patientName || tx.patientReferenceId ? (
                            <div className="space-y-1">
                              {tx.patientName && <p className="text-sm font-medium">{tx.patientName}</p>}
                              {tx.patientReferenceId && (
                                <p className="text-sm text-muted-foreground">Ref: {tx.patientReferenceId}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
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
            <div className="py-16 text-center">
              <p className="text-lg text-muted-foreground">No transactions found</p>
            </div>
          )}
        </Card>

        {/* Transaction Details Modal */}
        <Dialog open={modalOpened} onOpenChange={() => {
          setModalOpened(false);
          setSelectedTransaction(null);
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
            </DialogHeader>
            {selectedTransaction && (
              <div className="space-y-4">
                {/* Action Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Action Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Transaction ID:</p>
                        <p className="text-sm font-mono">{selectedTransaction.transactionId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Type:</p>
                        <Badge variant={getTypeBadgeVariant(selectedTransaction.type)} className="mt-1">
                          {selectedTransaction.type.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Quantity:</p>
                        <Badge 
                          variant="outline"
                          className={cn(
                            selectedTransaction.type === 'check_out' && 'border-red-500 text-red-600',
                            selectedTransaction.type === 'check_in' && 'border-green-500 text-green-600',
                            'mt-1'
                          )}
                        >
                          {selectedTransaction.type === 'check_out' ? '-' : '+'}{selectedTransaction.quantity}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Performed By:</p>
                        <p className="text-sm">{selectedTransaction.user?.username || 'Unknown'}</p>
                      </div>
                    </div>
                    {selectedTransaction.notes && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Notes:</p>
                          <p className="text-sm">{selectedTransaction.notes}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Timestamp */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Timestamp</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Date:</p>
                        <p className="text-sm">{new Date(selectedTransaction.timestamp).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Time:</p>
                        <p className="text-sm">{new Date(selectedTransaction.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Full Timestamp:</p>
                      <p className="text-sm font-mono">{new Date(selectedTransaction.timestamp).toISOString()}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Patient Information (if checkout) */}
                {selectedTransaction.type === 'check_out' && (selectedTransaction.patientName || selectedTransaction.patientReferenceId) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Patient Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedTransaction.patientName && (
                        <div className="grid grid-cols-2">
                          <p className="text-sm text-muted-foreground">Patient Name:</p>
                          <p className="text-sm">{selectedTransaction.patientName}</p>
                        </div>
                      )}
                      {selectedTransaction.patientReferenceId && (
                        <div className="grid grid-cols-2">
                          <p className="text-sm text-muted-foreground">Reference ID:</p>
                          <p className="text-sm font-mono">{selectedTransaction.patientReferenceId}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Medication/Unit Information */}
                {selectedTransaction.unit && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Medication Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Medication:</p>
                          <p className="text-sm font-semibold">{selectedTransaction.unit.drug.medicationName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Generic Name:</p>
                          <p className="text-sm">{selectedTransaction.unit.drug.genericName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Strength:</p>
                          <Badge variant="outline" className="mt-1">
                            {selectedTransaction.unit.drug.strength} {selectedTransaction.unit.drug.strengthUnit}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Form:</p>
                          <p className="text-sm">{selectedTransaction.unit.drug.form}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">NDC:</p>
                          <p className="text-sm font-mono">{selectedTransaction.unit.drug.ndcId}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Current Stock:</p>
                          <Badge 
                            variant={selectedTransaction.unit.availableQuantity > 0 ? 'default' : 'secondary'}
                            className="mt-1"
                          >
                            {selectedTransaction.unit.availableQuantity} / {selectedTransaction.unit.totalQuantity}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Expiry Date:</p>
                          <Badge
                            variant={new Date(selectedTransaction.unit.expiryDate) < new Date() ? 'destructive' : 'secondary'}
                            className="mt-1"
                          >
                            {new Date(selectedTransaction.unit.expiryDate).toLocaleDateString()}
                          </Badge>
                        </div>
                      </div>
                      {selectedTransaction.unit.lot && (
                        <>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Source:</p>
                              <p className="text-sm">{selectedTransaction.unit.lot.source}</p>
                            </div>
                            {selectedTransaction.unit.lot.location && (
                              <div>
                                <p className="text-sm text-muted-foreground">Storage Location:</p>
                                <p className="text-sm">
                                  {selectedTransaction.unit.lot.location.name} ({selectedTransaction.unit.lot.location.temp})
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      {selectedTransaction.unit.optionalNotes && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Unit Notes:</p>
                            <p className="text-sm">{selectedTransaction.unit.optionalNotes}</p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
