'use client';

import { useState } from 'react';
import { useLazyQuery, useMutation, gql } from '@apollo/client';
import {
  Stack,
  Title,
  Text,
  Card,
  Button,
  TextInput,
  NumberInput,
  Textarea,
  Group,
  Table,
  Badge,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AppShell } from '../../components/layout/AppShell';
import { QRScanner } from '../../components/QRScanner';
import { GetUnitResponse, SearchUnitsResponse, UnitData } from '../../types/graphql';
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
      }
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

export default function CheckOutPage() {
  const [unitId, setUnitId] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitData | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [patientReference, setPatientReference] = useState('');
  const [notes, setNotes] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);

  const [getUnit, { loading: loadingUnit }] = useLazyQuery<GetUnitResponse>(GET_UNIT, {
    onCompleted: (data) => {
      if (data.getUnit) {
        setSelectedUnit(data.getUnit);
        notifications.show({
          title: 'Unit Found',
          message: `${data.getUnit.drug.medicationName} - ${data.getUnit.availableQuantity} available`,
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

  const [searchUnits, { data: searchData }] = useLazyQuery<SearchUnitsResponse>(SEARCH_UNITS);

  const [checkOut, { loading: checkingOut }] = useMutation(CHECK_OUT_UNIT, {
    onCompleted: () => {
      notifications.show({
        title: 'Success',
        message: 'Unit checked out successfully',
        color: 'green',
      });
      handleReset();
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
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
    if (!selectedUnit || quantity <= 0) {
      notifications.show({
        title: 'Error',
        message: 'Please enter valid quantity',
        color: 'red',
      });
      return;
    }

    if (quantity > selectedUnit.availableQuantity) {
      notifications.show({
        title: 'Error',
        message: `Insufficient quantity. Available: ${selectedUnit.availableQuantity}`,
        color: 'red',
      });
      return;
    }

    checkOut({
      variables: {
        input: {
          unitId: selectedUnit.unitId,
          quantity,
          patientReferenceId: patientReference || undefined,
          notes: notes || undefined,
        },
      },
    });
  };

  const handleReset = () => {
    setUnitId('');
    setSelectedUnit(null);
    setQuantity(0);
    setPatientReference('');
    setNotes('');
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
          <Title order={1}>Check Out</Title>
          <Text c="dimmed" size="sm">
            Dispense medications to patients
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
              placeholder="Enter unit ID manually"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              rightSection={
                <Button size="xs" onClick={handleSearch} loading={loadingUnit}>
                  Search
                </Button>
              }
            />

            {searchData?.searchUnitsByQuery && searchData.searchUnitsByQuery.length > 0 && (
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
                    {searchData.searchUnitsByQuery.map((unit: UnitData) => (
                      <Table.Tr key={unit.unitId}>
                        <Table.Td>{unit.drug.medicationName}</Table.Td>
                        <Table.Td>{unit.availableQuantity}</Table.Td>
                        <Table.Td>{new Date(unit.expiryDate).toLocaleDateString()}</Table.Td>
                        <Table.Td>
                          <Button size="xs" onClick={() => handleSelectUnit(unit)}>
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

        {selectedUnit && (
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack>
              <Group justify="apart">
                <Title order={3}>Unit Details</Title>
                <Badge
                  color={selectedUnit.availableQuantity > 0 ? 'green' : 'red'}
                  size="lg"
                >
                  {selectedUnit.availableQuantity} Available
                </Badge>
              </Group>

              <Card withBorder p="sm" bg="blue.0">
                <Text fw={700} size="lg">
                  {selectedUnit.drug.medicationName}
                </Text>
                <Text size="sm" c="dimmed">
                  Generic: {selectedUnit.drug.genericName}
                </Text>
                <Text size="sm">
                  Strength: {selectedUnit.drug.strength} {selectedUnit.drug.strengthUnit}
                </Text>
                <Text size="sm">Form: {selectedUnit.drug.form}</Text>
                {selectedUnit.drug.ndcId && (
                  <Text size="sm">NDC: {selectedUnit.drug.ndcId}</Text>
                )}
              </Card>

              <Group grow>
                <div>
                  <Text size="sm" c="dimmed">
                    Total Quantity
                  </Text>
                  <Text fw={700}>{selectedUnit.totalQuantity}</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">
                    Expiry Date
                  </Text>
                  <Text fw={700}>
                    {new Date(selectedUnit.expiryDate).toLocaleDateString()}
                  </Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed">
                    Source
                  </Text>
                  <Text fw={700}>{selectedUnit.lot?.source}</Text>
                </div>
              </Group>

              {selectedUnit.optionalNotes && (
                <div>
                  <Text size="sm" c="dimmed">
                    Notes
                  </Text>
                  <Text>{selectedUnit.optionalNotes}</Text>
                </div>
              )}

              <Title order={4} mt="md">
                Dispense Medication
              </Title>

              <NumberInput
                label="Quantity to Dispense"
                placeholder="Enter quantity"
                required
                min={1}
                max={selectedUnit.availableQuantity}
                value={quantity}
                onChange={(value) => setQuantity(Number(value))}
              />

              <TextInput
                label="Patient Reference ID (Optional)"
                placeholder="Patient identifier or code"
                value={patientReference}
                onChange={(e) => setPatientReference(e.target.value)}
              />

              <Textarea
                label="Notes (Optional)"
                placeholder="Any additional notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <Group>
                <Button onClick={handleCheckOut} loading={checkingOut}>
                  Check Out
                </Button>
                <Button variant="light" onClick={handleReset}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        <QRScanner
          opened={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScanned}
          title="Scan DaanaRx QR Code"
          description="Scan the QR code on the medication unit to check it out"
        />
      </Stack>
    </AppShell>
  );
}
