'use client';

import { useState } from 'react';
import { useQuery, useLazyQuery, gql } from '@apollo/client';
import {
  Stack,
  Title,
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
} from '@mantine/core';
import { AppShell } from '../../components/layout/AppShell';
import { GetUnitsResponse, UnitData, GetTransactionsResponse, TransactionData } from '../../types/graphql';
import { QRCodeSVG } from 'qrcode.react';

const GET_UNITS = gql`
  query GetUnits($page: Int, $pageSize: Int, $search: String) {
    getUnits(page: $page, pageSize: $pageSize, search: $search) {
      units {
        unitId
        totalQuantity
        availableQuantity
        expiryDate
        drug {
          medicationName
          genericName
          strength
          strengthUnit
        }
        lot {
          source
        }
      }
      total
      page
      pageSize
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
        patientReferenceId
      }
    }
  }
`;

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  const { data, loading } = useQuery<GetUnitsResponse>(GET_UNITS, {
    variables: { page, pageSize: 20, search: search || undefined },
  });

  const [getTransactions, { data: transactionsData, loading: loadingTransactions }] =
    useLazyQuery<GetTransactionsResponse>(GET_TRANSACTIONS);

  const totalPages = data ? Math.ceil(data.getUnits.total / data.getUnits.pageSize) : 0;

  const handleRowClick = (unit: UnitData) => {
    setSelectedUnit(unit);
    setModalOpened(true);
    getTransactions({ variables: { unitId: unit.unitId } });
  };

  const handleCloseModal = () => {
    setModalOpened(false);
    setSelectedUnit(null);
  };

  return (
    <AppShell>
      <Stack gap="xl">
        <div>
          <Title order={1}>Inventory</Title>
          <Text c="dimmed" size="sm">
            View and manage all units
          </Text>
        </div>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <TextInput
            placeholder="Search inventory (medication, NDC, source, lot, quantity, notes...)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            mb="md"
          />

          {loading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : data?.getUnits.units && data.getUnits.units.length > 0 ? (
            <>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Medication</Table.Th>
                    <Table.Th>Generic Name</Table.Th>
                    <Table.Th>Strength</Table.Th>
                    <Table.Th>Available</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>Expiry</Table.Th>
                    <Table.Th>Source</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data?.getUnits.units.map((unit: UnitData) => {
                    const isExpired = new Date(unit.expiryDate) < new Date();
                    const isExpiringSoon =
                      new Date(unit.expiryDate) <
                      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                    return (
                      <Table.Tr
                        key={unit.unitId}
                        onClick={() => handleRowClick(unit)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Table.Td>{unit.drug.medicationName}</Table.Td>
                        <Table.Td>{unit.drug.genericName}</Table.Td>
                        <Table.Td>
                          {unit.drug.strength} {unit.drug.strengthUnit}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={unit.availableQuantity > 0 ? 'green' : 'red'}>
                            {unit.availableQuantity}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{unit.totalQuantity}</Table.Td>
                        <Table.Td>
                          <Badge
                            color={isExpired ? 'red' : isExpiringSoon ? 'orange' : 'gray'}
                          >
                            {new Date(unit.expiryDate).toLocaleDateString()}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{unit.lot?.source}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>

              <Group justify="center" mt="md">
                <Pagination total={totalPages} value={page} onChange={setPage} />
              </Group>
            </>
          ) : (
            <Text c="dimmed">No units found</Text>
          )}
        </Card>

        <Modal
          opened={modalOpened}
          onClose={handleCloseModal}
          title="Unit Details"
          size="xl"
          centered
        >
          {selectedUnit && (
            <Stack>
              {/* QR Code Section */}
              <Card withBorder p="md">
                <Title order={4} mb="md">
                  QR Code
                </Title>
                <Center>
                  <QRCodeSVG value={selectedUnit.unitId} size={200} />
                </Center>
                <Text size="xs" c="dimmed" ta="center" mt="sm">
                  Unit ID: {selectedUnit.unitId}
                </Text>
              </Card>

              {/* Unit Information */}
              <Card withBorder p="md">
                <Title order={4} mb="md">
                  Medication Information
                </Title>
                <Stack gap="xs">
                  <Group justify="apart">
                    <Text fw={500}>Medication:</Text>
                    <Text>{selectedUnit.drug.medicationName}</Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Generic:</Text>
                    <Text>{selectedUnit.drug.genericName}</Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Strength:</Text>
                    <Text>
                      {selectedUnit.drug.strength} {selectedUnit.drug.strengthUnit}
                    </Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Available / Total:</Text>
                    <Text>
                      {selectedUnit.availableQuantity} / {selectedUnit.totalQuantity}
                    </Text>
                  </Group>
                  <Group justify="apart">
                    <Text fw={500}>Expiry Date:</Text>
                    <Text>{new Date(selectedUnit.expiryDate).toLocaleDateString()}</Text>
                  </Group>
                  {selectedUnit.lot && (
                    <Group justify="apart">
                      <Text fw={500}>Source:</Text>
                      <Text>{selectedUnit.lot.source}</Text>
                    </Group>
                  )}
                </Stack>
              </Card>

              {/* Transaction History */}
              <Card withBorder p="md">
                <Title order={4} mb="md">
                  Transaction History
                </Title>
                {loadingTransactions ? (
                  <Center h={100}>
                    <Loader />
                  </Center>
                ) : transactionsData?.getTransactions.transactions &&
                  transactionsData.getTransactions.transactions.length > 0 ? (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Date & Time</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Quantity</Table.Th>
                        <Table.Th>Notes</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {transactionsData.getTransactions.transactions.map((tx: TransactionData) => (
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
                  <Text c="dimmed">No transactions found</Text>
                )}
              </Card>
            </Stack>
          )}
        </Modal>
      </Stack>
    </AppShell>
  );
}
