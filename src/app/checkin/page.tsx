'use client';

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import {
  Stack,
  Title,
  Text,
  Card,
  Button,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Stepper,
  Group,
  Modal,
  Alert,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { QRCodeSVG } from 'qrcode.react';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { IconQrcode } from '@tabler/icons-react';
import {
  GetLocationsResponse,
  GetLotsResponse,
  SearchDrugByNDCResponse,
  DrugData,
  LotData,
  LocationData,
} from '../../types/graphql';
import { RootState } from '../../store';

const GET_LOCATIONS = gql`
  query GetLocations {
    getLocations {
      locationId
      name
      temp
    }
  }
`;

const GET_LOTS = gql`
  query GetLots {
    getLots {
      lotId
      source
      locationId
      dateCreated
    }
  }
`;

const CREATE_LOT = gql`
  mutation CreateLot($input: CreateLotInput!) {
    createLot(input: $input) {
      lotId
      source
      note
    }
  }
`;

const SEARCH_DRUG_BY_NDC = gql`
  query SearchDrugByNDC($ndc: String!) {
    searchDrugByNDC(ndc: $ndc) {
      drugId
      medicationName
      genericName
      strength
      strengthUnit
      ndcId
      form
    }
  }
`;

const CREATE_UNIT = gql`
  mutation CreateUnit($input: CreateUnitInput!) {
    createUnit(input: $input) {
      unitId
      totalQuantity
      availableQuantity
      expiryDate
      drug {
        medicationName
        genericName
      }
    }
  }
`;

export default function CheckInPage() {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const [activeStep, setActiveStep] = useState(0);

  // Lot creation state
  const [lotSource, setLotSource] = useState('');
  const [lotNote, setLotNote] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [useExistingLot, setUseExistingLot] = useState(false);

  // Drug search state
  const [ndcInput, setNdcInput] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<DrugData | null>(null);
  const [manualDrug, setManualDrug] = useState<Omit<DrugData, 'drugId'>>({
    medicationName: '',
    genericName: '',
    strength: 0,
    strengthUnit: 'mg',
    ndcId: '',
    form: 'Tablet',
  });

  // Unit creation state
  const [totalQuantity, setTotalQuantity] = useState<number>(0);
  const [availableQuantity, setAvailableQuantity] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [unitNotes, setUnitNotes] = useState('');
  const [createdUnitId, setCreatedUnitId] = useState<string>('');
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Scanner state
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Queries
  const { data: locationsData } = useQuery<GetLocationsResponse>(GET_LOCATIONS);
  const { data: lotsData } = useQuery<GetLotsResponse>(GET_LOTS);
  const { refetch: searchNDC } = useQuery<SearchDrugByNDCResponse>(SEARCH_DRUG_BY_NDC, {
    skip: true,
  });
  
  // Check if there are any locations
  const hasLocations = locationsData?.getLocations && locationsData.getLocations.length > 0;
  const isAdmin = user?.userRole === 'admin' || user?.userRole === 'superadmin';

  // Mutations
  const [createLot, { loading: creatingLot }] = useMutation(CREATE_LOT, {
    refetchQueries: [{ query: GET_LOTS }],
    onCompleted: (data) => {
      setSelectedLotId(data.createLot.lotId);
      notifications.show({
        title: 'Success',
        message: 'Lot created successfully',
        color: 'green',
      });
      setActiveStep(1);
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const [createUnit, { loading: creatingUnit }] = useMutation(CREATE_UNIT, {
    refetchQueries: ['GetDashboardStats', 'GetUnits'],
    onCompleted: (data) => {
      setCreatedUnitId(data.createUnit.unitId);
      notifications.show({
        title: 'Success',
        message: `Unit created successfully! Transaction logged.`,
        color: 'green',
      });
      setShowQRModal(true);
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error.message,
        color: 'red',
      });
    },
  });

  const handleCreateLot = () => {
    if (useExistingLot) {
      if (!selectedLotId) {
        notifications.show({
          title: 'Error',
          message: 'Please select a lot',
          color: 'red',
        });
        return;
      }
      setActiveStep(1);
      return;
    }

    createLot({
      variables: {
        input: {
          source: lotSource,
          note: lotNote,
          locationId: selectedLocationId,
        },
      },
    });
  };

  const handleSearchNDC = async (ndc?: string) => {
    const searchCode = ndc || ndcInput;
    if (!searchCode.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please enter an NDC code',
        color: 'red',
      });
      return;
    }

    try {
      const result = await searchNDC({ ndc: searchCode });
      if (result.data?.searchDrugByNDC) {
        setSelectedDrug(result.data.searchDrugByNDC);
        setNdcInput(searchCode);
        notifications.show({
          title: 'Found',
          message: `Found: ${result.data.searchDrugByNDC.medicationName}`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Not Found',
          message: 'Drug not found. Please enter manually.',
          color: 'orange',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to search drug',
        color: 'red',
      });
    }
  };

  const handleBarcodeScanned = (code: string) => {
    setShowBarcodeScanner(false);
    handleSearchNDC(code);
  };

  const handleCreateUnit = () => {
    if (!selectedLotId || !expiryDate) {
      notifications.show({
        title: 'Error',
        message: 'Please fill all required fields',
        color: 'red',
      });
      return;
    }

    const drugData = selectedDrug || manualDrug;

    createUnit({
      variables: {
        input: {
          totalQuantity,
          availableQuantity,
          lotId: selectedLotId,
          expiryDate: expiryDate.toISOString().split('T')[0],
          drugId: selectedDrug?.drugId,
          drugData: !selectedDrug?.drugId ? drugData : undefined,
          optionalNotes: unitNotes,
        },
      },
    });
  };

  const handleReset = () => {
    setActiveStep(0);
    setLotSource('');
    setLotNote('');
    setSelectedLocationId('');
    setSelectedLotId('');
    setUseExistingLot(false);
    setNdcInput('');
    setSelectedDrug(null);
    setTotalQuantity(0);
    setAvailableQuantity(0);
    setExpiryDate(null);
    setUnitNotes('');
    setCreatedUnitId('');
    setShowQRModal(false);
  };

  return (
    <AppShell>
      <Stack gap="xl">
        <PageHeader title="Check In" description="Add new medications to inventory" />

        {!hasLocations && (
          <Alert icon={<IconAlertCircle size={16} />} title="No Storage Locations" color={isAdmin ? "yellow" : "red"} variant="filled">
            {isAdmin ? (
              <>
                You need to create at least one storage location before checking in medications.{' '}
                <Button variant="white" size="xs" onClick={() => router.push('/admin')} ml="xs">
                  Go to Admin
                </Button>
              </>
            ) : (
              'No storage locations are available. Please contact your administrator to create storage locations before checking in medications.'
            )}
          </Alert>
        )}

        <Stepper active={activeStep} onStepClick={setActiveStep}>
          <Stepper.Step label="Create Lot" description="Donation source">
            <Card shadow="sm" padding="lg" radius="md" withBorder mt="md">
              <Stack>
                <Group>
                  <Button
                    variant={!useExistingLot ? 'filled' : 'light'}
                    onClick={() => setUseExistingLot(false)}
                  >
                    Create New Lot
                  </Button>
                  <Button
                    variant={useExistingLot ? 'filled' : 'light'}
                    onClick={() => setUseExistingLot(true)}
                  >
                    Use Existing Lot
                  </Button>
                </Group>

                {useExistingLot ? (
                  <Select
                    label="Select Lot"
                    placeholder="Choose existing lot"
                    data={
                      lotsData?.getLots.map((lot: LotData) => ({
                        value: lot.lotId,
                        label: `${lot.source} - ${new Date(lot.dateCreated).toLocaleDateString()}`,
                      })) || []
                    }
                    value={selectedLotId}
                    onChange={(value) => setSelectedLotId(value || '')}
                  />
                ) : (
                  <>
                    <TextInput
                      label="Donation Source"
                      placeholder="e.g., CVS Pharmacy"
                      required
                      value={lotSource}
                      onChange={(e) => setLotSource(e.target.value)}
                    />

                    <Select
                      label="Storage Location"
                      placeholder="Select location"
                      required
                      data={
                        locationsData?.getLocations.map((loc: LocationData) => ({
                          value: loc.locationId,
                          label: `${loc.name} (${loc.temp})`,
                        })) || []
                      }
                      value={selectedLocationId}
                      onChange={(value) => setSelectedLocationId(value || '')}
                    />

                    <Textarea
                      label="Notes (Optional)"
                      placeholder="Any additional information"
                      value={lotNote}
                      onChange={(e) => setLotNote(e.target.value)}
                    />
                  </>
                )}

                <Button onClick={handleCreateLot} loading={creatingLot}>
                  Continue to Drug Search
                </Button>
              </Stack>
            </Card>
          </Stepper.Step>

          <Stepper.Step label="Find Drug" description="NDC or manual entry">
            <Card shadow="sm" padding="lg" radius="md" withBorder mt="md">
              <Stack>
                <Group>
                  <Button
                    leftSection={<IconQrcode size={16} />}
                    onClick={() => setShowBarcodeScanner(true)}
                    fullWidth
                  >
                    Scan Barcode
                  </Button>
                </Group>

                <Group align="flex-end" gap="xs">
                  <TextInput
                    label="NDC Barcode"
                    placeholder="Enter NDC code"
                    value={ndcInput}
                    onChange={(e) => setNdcInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchNDC();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button onClick={() => handleSearchNDC()}>
                    Search
                  </Button>
                </Group>

                {selectedDrug && (
                  <Card withBorder p="sm" bg="green.0">
                    <Text fw={700}>{selectedDrug.medicationName}</Text>
                    <Text size="sm">
                      {selectedDrug.strength} {selectedDrug.strengthUnit} - {selectedDrug.form}
                    </Text>
                  </Card>
                )}

                <Title order={4}>Or enter manually:</Title>

                <TextInput
                  label="Medication Name"
                  placeholder="e.g., Lisinopril 10mg Tablet"
                  value={manualDrug.medicationName}
                  onChange={(e) =>
                    setManualDrug({ ...manualDrug, medicationName: e.target.value })
                  }
                />

                <TextInput
                  label="Generic Name"
                  placeholder="e.g., Lisinopril"
                  value={manualDrug.genericName}
                  onChange={(e) =>
                    setManualDrug({ ...manualDrug, genericName: e.target.value })
                  }
                />

                <Group grow>
                  <NumberInput
                    label="Strength"
                    placeholder="10"
                    value={manualDrug.strength}
                    onChange={(value) =>
                      setManualDrug({ ...manualDrug, strength: Number(value) })
                    }
                  />
                  <TextInput
                    label="Unit"
                    placeholder="mg"
                    value={manualDrug.strengthUnit}
                    onChange={(e) =>
                      setManualDrug({ ...manualDrug, strengthUnit: e.target.value })
                    }
                  />
                </Group>

                <Group grow>
                  <TextInput
                    label="NDC ID"
                    placeholder="Optional"
                    value={manualDrug.ndcId}
                    onChange={(e) =>
                      setManualDrug({ ...manualDrug, ndcId: e.target.value })
                    }
                  />
                  <TextInput
                    label="Form"
                    placeholder="Tablet"
                    value={manualDrug.form}
                    onChange={(e) =>
                      setManualDrug({ ...manualDrug, form: e.target.value })
                    }
                  />
                </Group>

                <Button onClick={() => setActiveStep(2)}>Continue to Unit Details</Button>
              </Stack>
            </Card>
          </Stepper.Step>

          <Stepper.Step label="Create Unit" description="Quantity and expiry">
            <Card shadow="sm" padding="lg" radius="md" withBorder mt="md">
              <Stack>
                <NumberInput
                  label="Total Quantity"
                  placeholder="100"
                  required
                  value={totalQuantity}
                  onChange={(value) => {
                    const num = Number(value);
                    setTotalQuantity(num);
                    if (availableQuantity === 0) {
                      setAvailableQuantity(num);
                    }
                  }}
                />

                <NumberInput
                  label="Available Quantity"
                  placeholder="100"
                  required
                  value={availableQuantity}
                  onChange={(value) => setAvailableQuantity(Number(value))}
                />

                <DateInput
                  label="Expiry Date"
                  placeholder="Select expiry date"
                  required
                  value={expiryDate}
                  onChange={setExpiryDate}
                />

                <Textarea
                  label="Notes (Optional)"
                  placeholder="Any additional notes"
                  value={unitNotes}
                  onChange={(e) => setUnitNotes(e.target.value)}
                />

                <Button onClick={handleCreateUnit} loading={creatingUnit}>
                  Create Unit
                </Button>
              </Stack>
            </Card>
          </Stepper.Step>
        </Stepper>

        <Modal
          opened={showQRModal}
          onClose={() => setShowQRModal(false)}
          title="Unit Created Successfully"
          centered
          size="md"
        >
          <Stack align="center">
            <Text>Unit ID: {createdUnitId}</Text>
            {createdUnitId && (
              <QRCodeSVG value={createdUnitId} size={256} level="H" />
            )}
            <Group>
              <Button onClick={() => window.print()}>Print Label</Button>
              <Button variant="light" onClick={handleReset}>
                Add Another Unit
              </Button>
            </Group>
          </Stack>
        </Modal>

        <BarcodeScanner
          opened={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onScan={handleBarcodeScanned}
          title="Scan NDC Barcode"
          description="Position the NDC barcode within the frame to search for drug information"
        />
      </Stack>
    </AppShell>
  );
}
