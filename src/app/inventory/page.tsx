'use client';

import { useState, useRef } from 'react';
import { useQuery, useLazyQuery, useMutation, gql } from '@apollo/client';
import { useRouter } from 'next/navigation';
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
  Button,
  Select,
  ActionIcon,
  Menu,
  Alert,
  Divider,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconDotsVertical,
  IconShoppingCartOff,
  IconAlertTriangle,
  IconQrcode,
  IconPrinter,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { TransactionData, GetLocationsResponse, LocationData, DrugData } from '../../types/graphql';
import { QRCodeSVG } from 'qrcode.react';
import { useReactToPrint } from 'react-to-print';

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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterLocation, setFilterLocation] = useState<string | null>(null);
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
    if (filterLocation) {
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
      notifications.show({
        title: 'Success',
        message: 'Unit checked out successfully',
        color: 'green',
      });
      setCheckoutModalOpened(false);
      setQuickCheckoutUnit(null);
      setCheckoutQuantity('1');
      refetch();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const totalPages = data ? Math.ceil(data.getUnits.total / data.getUnits.pageSize) : 0;

  // Filter units by location
  const filteredUnits = data?.getUnits.units.filter((unit) => {
    if (!filterLocation) return true;
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
      notifications.show({
        title: 'Error',
        message: 'Please enter a valid quantity',
        color: 'red',
      });
      return;
    }

    if (qty > quickCheckoutUnit.availableQuantity) {
      notifications.show({
        title: 'Error',
        message: 'Quantity exceeds available stock',
        color: 'red',
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

  const locationOptions = locationsData?.getLocations.map((loc: LocationData) => ({
    value: loc.locationId,
    label: `${loc.name} (${loc.temp.replace('_', ' ')})`,
  })) || [];

  return (
    <AppShell>
      <Stack gap="xl">
        <PageHeader title="Inventory" description="View and manage all units" />

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
              Click on any row to view unit details, QR code, and transaction history. Use the action menu (⋮) for quick checkout or quarantine.
            </Alert>

            <TextInput
              placeholder="Search inventory (medication, NDC, source, lot, quantity, notes...)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            <Group gap="md" align="flex-end">
              <div style={{ flex: 1 }}>
                <Text size="sm" fw={500} c="dimmed" mb={4}>Filter by Form:</Text>
                <Button.Group>
                  <Button
                    variant={filterType === 'all' ? 'filled' : 'default'}
                    size="xs"
                    onClick={() => {
                      setFilterType('all');
                      setPage(1);
                    }}
                  >
                    All
                  </Button>
                  <Button
                    variant={filterType === 'tablet' ? 'filled' : 'default'}
                    size="xs"
                    onClick={() => {
                      setFilterType('tablet');
                      setPage(1);
                    }}
                  >
                    Tablet
                  </Button>
                  <Button
                    variant={filterType === 'capsule' ? 'filled' : 'default'}
                    size="xs"
                    onClick={() => {
                      setFilterType('capsule');
                      setPage(1);
                    }}
                  >
                    Capsule
                  </Button>
                  <Button
                    variant={filterType === 'liquid' ? 'filled' : 'default'}
                    size="xs"
                    onClick={() => {
                      setFilterType('liquid');
                      setPage(1);
                    }}
                  >
                    Liquid
                  </Button>
                  <Button
                    variant={filterType === 'injection' ? 'filled' : 'default'}
                    size="xs"
                    onClick={() => {
                      setFilterType('injection');
                      setPage(1);
                    }}
                  >
                    Injection
                  </Button>
                </Button.Group>
              </div>

              <Select
                label="Filter by Location"
                placeholder="All Locations"
                data={locationOptions}
                value={filterLocation}
                onChange={(value) => {
                  setFilterLocation(value);
                  setPage(1);
                }}
                clearable
                style={{ minWidth: 200 }}
              />
            </Group>
          </Stack>

          {loading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : filteredUnits.length > 0 ? (
            <>
              <Table highlightOnHover mt="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Medication</Table.Th>
                    <Table.Th>Strength</Table.Th>
                    <Table.Th>Available</Table.Th>
                    <Table.Th>Expiry</Table.Th>
                    <Table.Th>Location</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th style={{ width: 60 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredUnits.map((unit) => {
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
                        <Table.Td>
                          <div>
                            <Text size="sm" fw={500}>{unit.drug.medicationName}</Text>
                            <Text size="xs" c="dimmed">{unit.drug.genericName}</Text>
                          </div>
                        </Table.Td>
                        <Table.Td>
                          {unit.drug.strength} {unit.drug.strengthUnit}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={unit.availableQuantity > 0 ? 'green' : 'red'}>
                            {unit.availableQuantity} / {unit.totalQuantity}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={isExpired ? 'red' : isExpiringSoon ? 'orange' : 'gray'}
                          >
                            {new Date(unit.expiryDate).toLocaleDateString()}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {unit.lot?.location ? (
                            <Badge variant="outline" color="grape">
                              {unit.lot.location.name}
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{unit.lot?.source || '-'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Menu shadow="md" width={180} position="bottom-end">
                            <Menu.Target>
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IconDotsVertical size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Label>Quick Actions</Menu.Label>
                              <Menu.Item
                                leftSection={<IconShoppingCartOff size={14} />}
                                onClick={(e) => handleQuickCheckout(unit, e)}
                                disabled={unit.availableQuantity === 0}
                              >
                                Quick Checkout
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconQrcode size={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRowClick(unit);
                                }}
                              >
                                View QR Code
                              </Menu.Item>
                              <Menu.Divider />
                              <Menu.Item
                                leftSection={<IconAlertTriangle size={14} />}
                                color="orange"
                                onClick={(e) => handleQuarantine(unit, e)}
                                disabled={unit.availableQuantity === 0}
                              >
                                Quarantine
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Table.Td>
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
            <Text c="dimmed" mt="md">No units found</Text>
          )}
        </Card>

        {/* Unit Details Modal */}
        <Modal
          opened={modalOpened}
          onClose={handleCloseModal}
          title="Unit Details"
          size="xl"
          centered
        >
          {selectedUnit && (
            <Stack>
              {/* QR Code Section with Print */}
              <Card withBorder p="md">
                <Group justify="space-between" mb="md">
                  <Title order={4}>QR Code</Title>
                  <Button
                    leftSection={<IconPrinter size={16} />}
                    variant="light"
                    onClick={() => handlePrint()}
                    size="sm"
                  >
                    Print Label
                  </Button>
                </Group>
                <Center>
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
                      
                      {/* Label Information - Right Side (US Medicine Labelling) */}
                      <div style={{ 
                        flex: 1, 
                        paddingLeft: '12px',
                        fontSize: '9px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}>
                        {/* Drug Name - Most Prominent */}
                        <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: 1.1, marginBottom: '1px' }}>
                          {selectedUnit.drug.medicationName}
                        </div>
                        <div style={{ fontSize: '9px', color: '#666', marginBottom: '3px' }}>
                          ({selectedUnit.drug.genericName})
                        </div>
                        
                        {/* Strength and Form */}
                        <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '3px' }}>
                          {selectedUnit.drug.strength} {selectedUnit.drug.strengthUnit} - {selectedUnit.drug.form}
                        </div>
                        
                        {/* NDC */}
                        <div style={{ marginBottom: '2px' }}>
                          <span style={{ fontWeight: '600' }}>NDC: </span>
                          {selectedUnit.drug.ndcId}
                        </div>
                        
                        {/* Quantity */}
                        <div style={{ marginBottom: '2px' }}>
                          <span style={{ fontWeight: '600' }}>Qty: </span>
                          {selectedUnit.availableQuantity} / {selectedUnit.totalQuantity}
                        </div>
                        
                        {/* Expiry - Required by US Law */}
                        <div style={{ marginBottom: '2px' }}>
                          <span style={{ fontWeight: '600' }}>EXP: </span>
                          {new Date(selectedUnit.expiryDate).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' })}
                        </div>
                        
                        {/* Lot/Source */}
                        <div style={{ marginBottom: '2px' }}>
                          <span style={{ fontWeight: '600' }}>LOT: </span>
                          {selectedUnit.lot?.source || 'N/A'}
                        </div>
                        
                        {/* Storage */}
                        {selectedUnit.lot?.location && (
                          <div style={{ fontSize: '8px', color: '#666' }}>
                            Store: {selectedUnit.lot.location.name}
                          </div>
                        )}
                        
                        {/* Footer - Organization */}
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
                </Center>
              </Card>

              {/* Unit Information */}
              <Card withBorder p="md">
                <Title order={4} mb="md">
                  Medication Information
                </Title>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500}>Medication:</Text>
                    <Text>{selectedUnit.drug.medicationName}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text fw={500}>Generic:</Text>
                    <Text>{selectedUnit.drug.genericName}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text fw={500}>Strength:</Text>
                    <Text>
                      {selectedUnit.drug.strength} {selectedUnit.drug.strengthUnit}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text fw={500}>Form:</Text>
                    <Text>{selectedUnit.drug.form}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text fw={500}>NDC:</Text>
                    <Text ff="monospace">{selectedUnit.drug.ndcId}</Text>
                  </Group>
                  <Divider my="xs" />
                  <Group justify="space-between">
                    <Text fw={500}>Available / Total:</Text>
                    <Text>
                      {selectedUnit.availableQuantity} / {selectedUnit.totalQuantity}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text fw={500}>Expiry Date:</Text>
                    <Text>{new Date(selectedUnit.expiryDate).toLocaleDateString()}</Text>
                  </Group>
                  {selectedUnit.lot && (
                    <>
                      <Group justify="space-between">
                        <Text fw={500}>Source:</Text>
                        <Text>{selectedUnit.lot.source}</Text>
                      </Group>
                      {selectedUnit.lot.location && (
                        <Group justify="space-between">
                          <Text fw={500}>Location:</Text>
                          <Badge variant="outline">
                            {selectedUnit.lot.location.name} ({selectedUnit.lot.location.temp.replace('_', ' ')})
                          </Badge>
                        </Group>
                      )}
                    </>
                  )}
                  {selectedUnit.optionalNotes && (
                    <>
                      <Divider my="xs" />
                      <Text fw={500}>Notes:</Text>
                      <Text>{selectedUnit.optionalNotes}</Text>
                    </>
                  )}
                </Stack>
              </Card>

              {/* Quick Actions */}
              <Card withBorder p="md">
                <Title order={4} mb="md">Quick Actions</Title>
                <Group>
                  <Button
                    leftSection={<IconShoppingCartOff size={16} />}
                    onClick={() => router.push(`/checkout?unitId=${selectedUnit.unitId}`)}
                    disabled={selectedUnit.availableQuantity === 0}
                  >
                    Checkout
                  </Button>
                  <Button
                    leftSection={<IconAlertTriangle size={16} />}
                    color="orange"
                    variant="outline"
                    onClick={() => {
                      handleCloseModal();
                      handleQuarantine(selectedUnit, { stopPropagation: () => {} } as React.MouseEvent);
                    }}
                    disabled={selectedUnit.availableQuantity === 0}
                  >
                    Quarantine All
                  </Button>
                </Group>
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
                        <Table.Th>User</Table.Th>
                        <Table.Th>Notes</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {transactionsData.getTransactions.transactions.map((tx) => (
                        <Table.Tr key={tx.transactionId}>
                          <Table.Td>{new Date(tx.timestamp).toLocaleString()}</Table.Td>
                          <Table.Td>
                            <Badge color={tx.type === 'check_in' ? 'green' : tx.type === 'check_out' ? 'blue' : 'orange'}>
                              {tx.type.replace('_', ' ')}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{tx.quantity}</Table.Td>
                          <Table.Td>{tx.user?.username || '-'}</Table.Td>
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

        {/* Quick Checkout Modal */}
        <Modal
          opened={checkoutModalOpened}
          onClose={() => {
            setCheckoutModalOpened(false);
            setQuickCheckoutUnit(null);
            setCheckoutQuantity('1');
          }}
          title="Quick Checkout"
          size="sm"
          centered
        >
          {quickCheckoutUnit && (
            <Stack>
              <Text size="sm">
                <strong>{quickCheckoutUnit.drug.medicationName}</strong>
              </Text>
              <Text size="sm" c="dimmed">
                Available: {quickCheckoutUnit.availableQuantity}
              </Text>
              <TextInput
                label="Quantity to checkout"
                type="number"
                min={1}
                max={quickCheckoutUnit.availableQuantity}
                value={checkoutQuantity}
                onChange={(e) => setCheckoutQuantity(e.target.value)}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setCheckoutModalOpened(false)}>
                  Cancel
                </Button>
                <Button onClick={handleQuickCheckoutSubmit} loading={checkingOut}>
                  Checkout
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Stack>
    </AppShell>
  );
}
