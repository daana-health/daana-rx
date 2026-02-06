'use client';

import { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { Loader2, Filter, Download, RefreshCw } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const GET_ALL_TRANSACTIONS = gql`
  query GetAllTransactions(
    $page: Int
    $pageSize: Int
    $type: String
    $startDate: Date
    $endDate: Date
    $medicationName: String
  ) {
    getAllTransactions(
      page: $page
      pageSize: $pageSize
      type: $type
      startDate: $startDate
      endDate: $endDate
      medicationName: $medicationName
    ) {
      transactions {
        transactionId
        timestamp
        type
        quantity
        notes
        user {
          username
        }
        unit {
          unitId
          drug {
            medicationName
            genericName
            strength
            strengthUnit
          }
        }
      }
      total
      page
      pageSize
    }
  }
`;

interface Transaction {
  transactionId: string;
  timestamp: string;
  type: 'check_in' | 'check_out' | 'adjust';
  quantity: number;
  notes?: string | null;
  user?: {
    username: string;
  };
  unit?: {
    unitId: string;
    drug?: {
      medicationName: string;
      genericName?: string;
      strength: number;
      strengthUnit: string;
    };
  };
}

interface GetAllTransactionsResponse {
  getAllTransactions: {
    transactions: Transaction[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [medicationFilter, setMedicationFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, loading, refetch } = useQuery<GetAllTransactionsResponse>(GET_ALL_TRANSACTIONS, {
    variables: {
      page,
      pageSize,
      type: typeFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      medicationName: medicationFilter || undefined,
    },
    fetchPolicy: 'network-only',
  });

  const transactions = data?.getAllTransactions.transactions || [];
  const total = data?.getAllTransactions.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleClearFilters = () => {
    setTypeFilter('');
    setStartDate('');
    setEndDate('');
    setMedicationFilter('');
    setPage(1);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'check_in':
        return 'Check In';
      case 'check_out':
        return 'Check Out';
      case 'adjust':
        return 'Adjustment';
      default:
        return type;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'check_in':
        return 'default';
      case 'check_out':
        return 'secondary';
      case 'adjust':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Activity Logs</h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              View all check-in, check-out, and adjustment transactions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-xl">Transaction History</CardTitle>
              <p className="text-sm text-muted-foreground">
                {total} total transactions
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </span>
                  <Badge variant="secondary" className="ml-2">
                    {[typeFilter, startDate, endDate, medicationFilter].filter(Boolean).length}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type-filter">Transaction Type</Label>
                    <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
                      <SelectTrigger id="type-filter">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        <SelectItem value="check_in">Check In</SelectItem>
                        <SelectItem value="check_out">Check Out</SelectItem>
                        <SelectItem value="adjust">Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medication-filter">Medication Name</Label>
                    <Input
                      id="medication-filter"
                      placeholder="Search by medication..."
                      value={medicationFilter}
                      onChange={(e) => { setMedicationFilter(e.target.value); setPage(1); }}
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center items-center h-[300px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : transactions.length > 0 ? (
              <>
                {/* Mobile Card View */}
                <div className="block lg:hidden space-y-3">
                  {transactions.map((tx) => (
                    <Card key={tx.transactionId} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm break-words">
                              {tx.unit?.drug?.medicationName || 'Unknown Medication'}
                            </p>
                            {tx.unit?.drug && (
                              <p className="text-xs text-muted-foreground">
                                {tx.unit.drug.strength}{tx.unit.drug.strengthUnit}
                              </p>
                            )}
                          </div>
                          <Badge variant={getTypeBadgeVariant(tx.type) as any} className="text-xs">
                            {getTypeLabel(tx.type)}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Qty: <span className="font-medium text-foreground">{tx.quantity}</span>
                          </span>
                          <span className="text-muted-foreground">
                            {tx.user?.username || 'System'}
                          </span>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.timestamp).toLocaleString()}
                        </div>

                        {tx.notes && (
                          <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                            {tx.notes}
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Date & Time</TableHead>
                        <TableHead className="min-w-[100px]">Type</TableHead>
                        <TableHead className="min-w-[100px]">User</TableHead>
                        <TableHead className="min-w-[200px]">Medication</TableHead>
                        <TableHead className="min-w-[80px]">Quantity</TableHead>
                        <TableHead className="min-w-[200px]">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.transactionId}>
                          <TableCell className="text-sm">
                            {new Date(tx.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getTypeBadgeVariant(tx.type) as any} className="text-xs">
                              {getTypeLabel(tx.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {tx.user?.username || 'System'}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-semibold text-sm">
                                {tx.unit?.drug?.medicationName || 'Unknown'}
                              </p>
                              {tx.unit?.drug && (
                                <p className="text-xs text-muted-foreground">
                                  {tx.unit.drug.strength}{tx.unit.drug.strengthUnit}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{tx.quantity}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={tx.notes || ''}>
                            {tx.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
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
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            pageNum = i + 1;
                          } else if (page >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = page - 2 + i;
                          }
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
              <div className="py-12 text-center text-muted-foreground">
                <p className="text-lg font-medium">No transactions found</p>
                <p className="text-sm mt-2">
                  {[typeFilter, startDate, endDate, medicationFilter].filter(Boolean).length > 0
                    ? 'Try adjusting your filters'
                    : 'Transaction history will appear here'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
