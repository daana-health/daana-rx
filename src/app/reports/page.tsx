'use client';

import { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import {
  Stack,
  Text,
  Card,
  Table,
  TextInput,
  Badge,
  Pagination,
  Group,
  Loader,
  Center,
  Modal,
  Title,
  Divider,
  Alert,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/PageHeader';

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

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'check_in':
        return 'green';
      case 'check_out':
        return 'blue';
      case 'adjust':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <AppShell>
      <Stack gap="xl">
        <PageHeader title="Reports" description="Transaction logs and audit trail" />

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              Click on any row to view full transaction details, medication information, and timestamps.
            </Alert>

            <TextInput
              placeholder="Search transactions (medication, user, type, quantity, notes, patient ref...)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Stack>

          {loading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : data?.getTransactions.transactions && data.getTransactions.transactions.length > 0 ? (
            <>
              <Table highlightOnHover mt="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date & Time</Table.Th>
                    <Table.Th>Medication</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Patient</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data?.getTransactions.transactions.map((tx) => (
                    <Table.Tr
                      key={tx.transactionId}
                      onClick={() => handleRowClick(tx)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Table.Td>
                        <Text size="sm">{formatDate(tx.timestamp)}</Text>
                      </Table.Td>
                      <Table.Td>
                        {tx.unit?.drug ? (
                          <div>
                            <Text size="sm" fw={500}>
                              {tx.unit.drug.medicationName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {tx.unit.drug.strength} {tx.unit.drug.strengthUnit} - {tx.unit.drug.form}
                            </Text>
                          </div>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getTypeBadgeColor(tx.type)}>
                          {tx.type.replace('_', ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline" color={tx.type === 'check_out' ? 'red' : 'green'}>
                          {tx.type === 'check_out' ? `-${tx.quantity}` : `+${tx.quantity}`}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{tx.user?.username || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        {tx.patientName || tx.patientReferenceId ? (
                          <div>
                            {tx.patientName && <Text size="sm">{tx.patientName}</Text>}
                            {tx.patientReferenceId && (
                              <Text size="xs" c="dimmed">Ref: {tx.patientReferenceId}</Text>
                            )}
                          </div>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group justify="center" mt="md">
                <Pagination total={totalPages} value={page} onChange={setPage} />
              </Group>
            </>
          ) : (
            <Text c="dimmed" mt="md">No transactions found</Text>
          )}
        </Card>

        {/* Transaction Details Modal */}
        <Modal
          opened={modalOpened}
          onClose={() => {
            setModalOpened(false);
            setSelectedTransaction(null);
          }}
          title="Transaction Details"
          size="lg"
          centered
        >
          {selectedTransaction && (
            <Stack gap="md">
              {/* Action Details */}
              <Card withBorder p="md">
                <Title order={5} mb="sm">Action Details</Title>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Transaction ID:</Text>
                    <Text size="sm" ff="monospace">{selectedTransaction.transactionId}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Type:</Text>
                    <Badge color={getTypeBadgeColor(selectedTransaction.type)} size="lg">
                      {selectedTransaction.type.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Quantity:</Text>
                    <Text size="sm" fw={600}>
                      {selectedTransaction.type === 'check_out' ? '-' : '+'}{selectedTransaction.quantity}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Performed By:</Text>
                    <Text size="sm">{selectedTransaction.user?.username || 'Unknown'}</Text>
                  </Group>
                  {selectedTransaction.notes && (
                    <>
                      <Divider my="xs" />
                      <Text size="sm" c="dimmed">Notes:</Text>
                      <Text size="sm">{selectedTransaction.notes}</Text>
                    </>
                  )}
                </Stack>
              </Card>

              {/* Timestamp */}
              <Card withBorder p="md">
                <Title order={5} mb="sm">Timestamp</Title>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Date:</Text>
                    <Text size="sm">{new Date(selectedTransaction.timestamp).toLocaleDateString()}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Time:</Text>
                    <Text size="sm">{new Date(selectedTransaction.timestamp).toLocaleTimeString()}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Full Timestamp:</Text>
                    <Text size="sm" ff="monospace">{new Date(selectedTransaction.timestamp).toISOString()}</Text>
                  </Group>
                </Stack>
              </Card>

              {/* Patient Information (if checkout) */}
              {selectedTransaction.type === 'check_out' && (selectedTransaction.patientName || selectedTransaction.patientReferenceId) && (
                <Card withBorder p="md">
                  <Title order={5} mb="sm">Patient Information</Title>
                  <Stack gap="xs">
                    {selectedTransaction.patientName && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">Patient Name:</Text>
                        <Text size="sm">{selectedTransaction.patientName}</Text>
                      </Group>
                    )}
                    {selectedTransaction.patientReferenceId && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">Reference ID:</Text>
                        <Text size="sm" ff="monospace">{selectedTransaction.patientReferenceId}</Text>
                      </Group>
                    )}
                  </Stack>
                </Card>
              )}

              {/* Medication/Unit Information */}
              {selectedTransaction.unit && (
                <Card withBorder p="md">
                  <Title order={5} mb="sm">Medication Information</Title>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Medication:</Text>
                      <Text size="sm" fw={600}>{selectedTransaction.unit.drug.medicationName}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Generic Name:</Text>
                      <Text size="sm">{selectedTransaction.unit.drug.genericName}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Strength:</Text>
                      <Text size="sm">
                        {selectedTransaction.unit.drug.strength} {selectedTransaction.unit.drug.strengthUnit}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Form:</Text>
                      <Text size="sm">{selectedTransaction.unit.drug.form}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">NDC:</Text>
                      <Text size="sm" ff="monospace">{selectedTransaction.unit.drug.ndcId}</Text>
                    </Group>
                    <Divider my="xs" />
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Unit ID:</Text>
                      <Text size="sm" ff="monospace">{selectedTransaction.unit.unitId}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Current Stock:</Text>
                      <Text size="sm">
                        {selectedTransaction.unit.availableQuantity} / {selectedTransaction.unit.totalQuantity}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Expiry Date:</Text>
                      <Badge
                        color={new Date(selectedTransaction.unit.expiryDate) < new Date() ? 'red' : 'gray'}
                      >
                        {new Date(selectedTransaction.unit.expiryDate).toLocaleDateString()}
                      </Badge>
                    </Group>
                    {selectedTransaction.unit.lot && (
                      <>
                        <Divider my="xs" />
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Source:</Text>
                          <Text size="sm">{selectedTransaction.unit.lot.source}</Text>
                        </Group>
                        {selectedTransaction.unit.lot.location && (
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">Storage Location:</Text>
                            <Text size="sm">
                              {selectedTransaction.unit.lot.location.name} ({selectedTransaction.unit.lot.location.temp})
                            </Text>
                          </Group>
                        )}
                      </>
                    )}
                    {selectedTransaction.unit.optionalNotes && (
                      <>
                        <Divider my="xs" />
                        <Text size="sm" c="dimmed">Unit Notes:</Text>
                        <Text size="sm">{selectedTransaction.unit.optionalNotes}</Text>
                      </>
                    )}
                  </Stack>
                </Card>
              )}
            </Stack>
          )}
        </Modal>
      </Stack>
    </AppShell>
  );
}
