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
import { useRouter } from 'next/navigation';
import { GetUnitResponse, GetTransactionsResponse, UnitData, TransactionData } from '../../types/graphql';

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

export default function ScanPage() {
  const router = useRouter();
  const [unitId, setUnitId] = useState('');
  const [unit, setUnit] = useState<UnitData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);

  const [getUnit, { loading }] = useLazyQuery<GetUnitResponse>(GET_UNIT, {
    onCompleted: (data) => {
      if (data.getUnit) {
        setUnit(data.getUnit);
        getTransactions({ variables: { unitId: data.getUnit.unitId } });
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

  const handleSearch = () => {
    if (unitId.trim()) {
      getUnit({ variables: { unitId: unitId.trim() } });
    }
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
            <TextInput
              label="Unit ID or QR Code"
              placeholder="Enter or scan unit ID"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <Button onClick={handleSearch} loading={loading}>
              Search
            </Button>
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
                          <Badge color={tx.type === 'check in' ? 'green' : 'blue'}>
                            {tx.type}
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
      </Stack>
    </AppShell>
  );
}
