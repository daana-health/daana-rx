'use client';

import { useState } from 'react';
import { useLazyQuery, gql } from '@apollo/client';
import {
  Stack,
  Title,
  Text,
  Card,
  Button,
  TextInput,
  Table,
  Badge,
  Group,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AppShell } from '../../components/layout/AppShell';
import { QRScanner } from '../../components/QRScanner';
import { useRouter } from 'next/navigation';
import { GetUnitResponse, GetTransactionsResponse, SearchUnitsResponse, UnitData, TransactionData } from '../../types/graphql';
import { IconQrcode } from '@tabler/icons-react';

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
  const [unitId, setUnitId] = useState('');
  const [unit, setUnit] = useState<UnitData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [showQRScanner, setShowQRScanner] = useState(false);

  const [getUnit] = useLazyQuery<GetUnitResponse>(GET_UNIT, {
    onCompleted: (data) => {
      if (data.getUnit) {
        setUnit(data.getUnit);
        getTransactions({ variables: { unitId: data.getUnit.unitId } });
        notifications.show({
          title: 'Unit Found',
          message: `${data.getUnit.drug.medicationName}`,
          color: 'green',
        });
      }
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Unit not found',
        color: 'red',
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
      <Stack gap="xl">
        <div>
          <Title order={1}>Scan / Lookup</Title>
          <Text c="dimmed" size="sm">
            Quick access to unit information
          </Text>
        </div>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack>
            <Group>
              <Button
                leftSection={<IconQrcode size={16} />}
                onClick={() => setShowQRScanner(true)}
                fullWidth
              >
                Scan QR Code
              </Button>
            </Group>

            <TextInput
              label="Unit ID"
              placeholder="Enter unit ID or search"
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                if (e.target.value.length >= 3) {
                  handleSearch();
                }
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              rightSection={
                unitId && (
                  <Button size="xs" variant="subtle" onClick={handleClear}>
                    Clear
                  </Button>
                )
              }
            />

            {searchData?.searchUnitsByQuery && searchData.searchUnitsByQuery.length > 0 && !unit && (
              <Card withBorder>
                <Title order={5} mb="sm">
                  Search Results
                </Title>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Medication</Table.Th>
                      <Table.Th>Available</Table.Th>
                      <Table.Th>Expiry</Table.Th>
                      <Table.Th>Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {searchData.searchUnitsByQuery.map((searchUnit: UnitData) => (
                      <Table.Tr key={searchUnit.unitId}>
                        <Table.Td>
                          <Text fw={500}>{searchUnit.drug.medicationName}</Text>
                          <Text size="xs" c="dimmed">{searchUnit.drug.genericName}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={searchUnit.availableQuantity > 0 ? 'green' : 'red'}>
                            {searchUnit.availableQuantity}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{new Date(searchUnit.expiryDate).toLocaleDateString()}</Table.Td>
                        <Table.Td>
                          <Button size="xs" onClick={() => handleSelectUnit(searchUnit)}>
                            Select
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            )}
          </Stack>
        </Card>

        {unit && (
          <>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Stack>
                <Group justify="apart">
                  <Title order={3}>{unit.drug.medicationName}</Title>
                  <Badge color={unit.availableQuantity > 0 ? 'green' : 'red'} size="lg">
                    {unit.availableQuantity} / {unit.totalQuantity}
                  </Badge>
                </Group>

                <Group grow>
                  <div>
                    <Text size="sm" c="dimmed">
                      Generic Name
                    </Text>
                    <Text fw={700}>{unit.drug.genericName}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed">
                      Strength
                    </Text>
                    <Text fw={700}>
                      {unit.drug.strength} {unit.drug.strengthUnit}
                    </Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed">
                      Form
                    </Text>
                    <Text fw={700}>{unit.drug.form}</Text>
                  </div>
                </Group>

                <Group grow>
                  <div>
                    <Text size="sm" c="dimmed">
                      Source
                    </Text>
                    <Text fw={700}>{unit.lot?.source}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed">
                      Expiry Date
                    </Text>
                    <Text fw={700}>{new Date(unit.expiryDate).toLocaleDateString()}</Text>
                  </div>
                </Group>

                {unit.optionalNotes && (
                  <div>
                    <Text size="sm" c="dimmed">
                      Notes
                    </Text>
                    <Text>{unit.optionalNotes}</Text>
                  </div>
                )}

                <Button
                  onClick={() => router.push(`/checkout?unitId=${unit.unitId}`)}
                  disabled={unit.availableQuantity === 0}
                >
                  Quick Check-Out
                </Button>
              </Stack>
            </Card>

            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Title order={4} mb="md">
                Transaction History
              </Title>
              {transactions.length > 0 ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Quantity</Table.Th>
                      <Table.Th>Notes</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {transactions.map((tx: TransactionData) => (
                      <Table.Tr key={tx.transactionId}>
                        <Table.Td>{new Date(tx.timestamp).toLocaleString()}</Table.Td>
                        <Table.Td>
                          <Badge color={tx.type === 'check_in' ? 'green' : 'blue'}>
                            {tx.type.replace('_', ' ')}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{tx.quantity}</Table.Td>
                        <Table.Td>{tx.notes || '-'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text c="dimmed">No transactions yet</Text>
              )}
            </Card>
          </>
        )}

        <QRScanner
          opened={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScanned}
          title="Scan DaanaRx QR Code"
          description="Scan the QR code on the medication unit to look it up"
        />
      </Stack>
    </AppShell>
  );
}
