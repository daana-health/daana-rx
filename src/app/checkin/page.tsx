'use client';

import { useState, useEffect, useRef } from 'react';
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
  Loader,
  Center,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconPrinter } from '@tabler/icons-react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/PageHeader';
import { QRCodeSVG } from 'qrcode.react';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { IconQrcode } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import {
  GetLocationsResponse,
  GetLotsResponse,
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

const SEARCH_DRUGS = gql`
  query SearchDrugs($query: String!) {
    searchDrugs(query: $query) {
      drugId
      medicationName
      genericName
      strength
      strengthUnit
      ndcId
      form
      inInventory
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

  // Unified drug search state
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<DrugData | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
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
  
  // Print ref
  const printRef = useRef<HTMLDivElement | null>(null);

  // Queries
  const { data: locationsData } = useQuery<GetLocationsResponse>(GET_LOCATIONS);
  const { data: lotsData } = useQuery<GetLotsResponse>(GET_LOTS);
  const { refetch: searchDrugs } = useQuery(SEARCH_DRUGS, {
    skip: true,
  });
  
  // Print handler
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `DaanaRX-Label-${createdUnitId}`,
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
  
  // Check if there are any locations
  const hasLocations = locationsData?.getLocations && locationsData.getLocations.length > 0;
  const isAdmin = user?.userRole === 'admin' || user?.userRole === 'superadmin';

  // Step validation functions
  const isStep1Valid = () => {
    if (useExistingLot) {
      return selectedLotId !== '';
    }
    return lotSource.trim() !== '' && selectedLocationId !== '';
  };

  const isStep2Valid = () => {
    if (selectedDrug) {
      return true;
    }
    // Check manual drug entry
    return (
      manualDrug.medicationName.trim() !== '' &&
      manualDrug.genericName.trim() !== '' &&
      manualDrug.strength > 0 &&
      manualDrug.strengthUnit.trim() !== '' &&
      manualDrug.ndcId.trim() !== '' &&
      manualDrug.form.trim() !== ''
    );
  };

  const isStep3Valid = () => {
    return (
      totalQuantity > 0 &&
      expiryDate !== null
    );
  };

  const nextStep = () => {
    if (activeStep === 0 && isStep1Valid()) {
      setActiveStep(1);
    } else if (activeStep === 1 && isStep2Valid()) {
      setActiveStep(2);
    }
  };

  const prevStep = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  // Debounced unified search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput.trim().length >= 2) {
        handleUnifiedSearch(searchInput);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Unified search using local database
  const handleUnifiedSearch = async (searchTerm: string) => {
    if (searchTerm.length < 2) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const result = await searchDrugs({ query: searchTerm });
      if (result.data?.searchDrugs && result.data.searchDrugs.length > 0) {
        setSearchResults(result.data.searchDrugs);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
        // If NDC search with no results, prepopulate NDC in manual form
        const cleanedNDC = searchTerm.replace(/[^0-9]/g, '');
        if (cleanedNDC.length >= 10) {
          setManualDrug({ ...manualDrug, ndcId: cleanedNDC });
          setShowManualEntry(true);
        }
      }
    } catch (error) {
      console.error('Drug search error:', error);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectDrug = (drug: any) => {
    setSelectedDrug(drug);
    setSearchInput(drug.ndcId);
    setSearchResults([]);
    setShowDropdown(false);
    setShowManualEntry(false);
    notifications.show({
      title: 'Drug Selected',
      message: drug.inInventory 
        ? `${drug.medicationName} (Already in inventory)` 
        : drug.medicationName,
      color: drug.inInventory ? 'blue' : 'green',
    });
  };

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
      // Auto-advance to drug search step after creating lot
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

  const handleBarcodeScanned = (code: string) => {
    setShowBarcodeScanner(false);
    setSearchInput(code);
    // Search will be triggered automatically by the useEffect
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
    setSearchInput('');
    setSelectedDrug(null);
    setShowManualEntry(false);
    setManualDrug({
      medicationName: '',
      genericName: '',
      strength: 0,
      strengthUnit: 'mg',
      ndcId: '',
      form: 'Tablet',
    });
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

        <Stepper active={activeStep}>
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

                {!useExistingLot && (
                  <Button onClick={handleCreateLot} loading={creatingLot}>
                    Create Lot
                  </Button>
                )}

                <Group justify="flex-end" mt="xl">
                  <Button 
                    onClick={nextStep} 
                    disabled={!isStep1Valid()}
                  >
                    Next Step
                  </Button>
                </Group>
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

                <div style={{ position: 'relative' }}>
                  <TextInput
                    label="Search by Drug Name or NDC"
                    placeholder="Start typing drug name or NDC code..."
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setShowDropdown(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowDropdown(false);
                      }
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) {
                        setShowDropdown(true);
                      }
                    }}
                    rightSection={searching ? <Loader size="xs" /> : null}
                  />

                  {showDropdown && searchResults.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        zIndex: 1000,
                        width: '100%',
                        marginTop: '4px',
                      }}
                    >
                      <Card 
                        withBorder 
                        shadow="md"
                        style={{ 
                          backgroundColor: 'white',
                        }}
                      >
                        <div
                          style={{
                            maxHeight: '400px',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                          }}
                        >
                          <Stack gap="xs">
                            {searchResults.length > 5 && (
                              <Text size="xs" c="dimmed" ta="center" pb="xs" style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                                Showing {searchResults.length} results - Scroll for more ↓
                              </Text>
                            )}
                            {searchResults.map((drug, index) => (
                              <Card
                                key={index}
                                padding="sm"
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleSelectDrug(drug)}
                                withBorder
                                bg={drug.inInventory ? 'blue.0' : 'white'}
                              >
                                <Group justify="space-between">
                                  <div>
                                    <Text fw={600} size="sm">{drug.medicationName}</Text>
                                    <Text size="xs" c="dimmed">
                                      {drug.strength} {drug.strengthUnit} - {drug.form}
                                    </Text>
                                    <Text size="xs" c="blue">NDC: {drug.ndcId}</Text>
                                  </div>
                                  {drug.inInventory && (
                                    <Text size="xs" c="blue" fw={700}>In Stock</Text>
                                  )}
                                </Group>
                              </Card>
                            ))}
                          </Stack>
                        </div>
                      </Card>
                    </div>
                  )}
                </div>

                {selectedDrug && (
                  <Card withBorder p="sm" bg={selectedDrug.inInventory ? "blue.0" : "green.0"}>
                    <Group justify="space-between">
                      <div>
                        <Text fw={700}>{selectedDrug.medicationName}</Text>
                        <Text size="sm">
                          {selectedDrug.strength} {selectedDrug.strengthUnit} - {selectedDrug.form}
                        </Text>
                        <Text size="xs" c="dimmed">NDC: {selectedDrug.ndcId}</Text>
                      </div>
                      {selectedDrug.inInventory && (
                        <Text size="sm" c="blue" fw={700}>Already in Inventory</Text>
                      )}
                    </Group>
                  </Card>
                )}

                {!selectedDrug && (
                  <>
                    <Button
                      variant="light"
                      onClick={() => setShowManualEntry(!showManualEntry)}
                      mt="md"
                    >
                      {showManualEntry ? 'Hide Manual Entry' : 'Enter Drug Manually'}
                    </Button>

                    {showManualEntry && (
                      <Title order={5} mt="md">Manual Drug Entry:</Title>
                    )}
                  </>
                )}

                {(showManualEntry || !selectedDrug) && showManualEntry && (
                <>
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
                  <Select
                    label="Unit"
                    placeholder="Select unit"
                    required
                    data={[
                      { value: 'mg', label: 'mg (milligrams)' },
                      { value: 'g', label: 'g (grams)' },
                      { value: 'mcg', label: 'mcg (micrograms)' },
                      { value: 'kg', label: 'kg (kilograms)' },
                      { value: 'mL', label: 'mL (milliliters)' },
                      { value: 'L', label: 'L (liters)' },
                    ]}
                    value={manualDrug.strengthUnit}
                    onChange={(value) =>
                      setManualDrug({ ...manualDrug, strengthUnit: value || 'mg' })
                    }
                  />
                </Group>

                <Group grow>
                  <TextInput
                    label="NDC ID"
                    placeholder="Enter NDC code"
                    required
                    value={manualDrug.ndcId}
                    onChange={(e) =>
                      setManualDrug({ ...manualDrug, ndcId: e.target.value })
                    }
                  />
                  <Select
                    label="Form"
                    placeholder="Select form"
                    required
                    data={[
                      { value: 'Tablet', label: 'Tablet' },
                      { value: 'Capsule', label: 'Capsule' },
                      { value: 'Liquid', label: 'Liquid' },
                      { value: 'Injection', label: 'Injection' },
                      { value: 'Cream', label: 'Cream' },
                      { value: 'Ointment', label: 'Ointment' },
                      { value: 'Patch', label: 'Patch' },
                      { value: 'Inhaler', label: 'Inhaler' },
                      { value: 'Suppository', label: 'Suppository' },
                    ]}
                    value={manualDrug.form}
                    onChange={(value) =>
                      setManualDrug({ ...manualDrug, form: value || 'Tablet' })
                    }
                  />
                </Group>
                </>
                )}

                <Group justify="space-between" mt="xl">
                  <Button 
                    variant="default" 
                    onClick={prevStep}
                  >
                    Previous
                  </Button>
                  <Button 
                    onClick={nextStep} 
                    disabled={!isStep2Valid()}
                  >
                    Next Step
                  </Button>
                </Group>
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
                    // Automatically set available quantity to match total quantity
                    setAvailableQuantity(num);
                  }}
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

                <Group justify="space-between" mt="xl">
                  <Button 
                    variant="default" 
                    onClick={prevStep}
                  >
                    Previous
                  </Button>
                  <Button 
                    onClick={handleCreateUnit} 
                    loading={creatingUnit}
                    disabled={!isStep3Valid()}
                  >
                    Create Unit
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stepper.Step>
        </Stepper>

        <Modal
          opened={showQRModal}
          onClose={() => setShowQRModal(false)}
          title="Unit Created Successfully"
          centered
          size="lg"
        >
          <Stack>
            <Alert color="green" variant="light">
              Unit has been added to inventory. Print the label below and attach it to the medication.
            </Alert>
            
            {/* Printable Label */}
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
                    <QRCodeSVG value={createdUnitId} size={100} level="H" />
                    <div style={{ fontSize: '6px', marginTop: '4px', textAlign: 'center', wordBreak: 'break-all', maxWidth: '100px', lineHeight: 1.2 }}>
                      {createdUnitId}
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
                      {selectedDrug?.medicationName || manualDrug.medicationName}
                    </div>
                    <div style={{ fontSize: '9px', color: '#666', marginBottom: '3px' }}>
                      ({selectedDrug?.genericName || manualDrug.genericName})
                    </div>
                    
                    {/* Strength and Form */}
                    <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '3px' }}>
                      {selectedDrug?.strength || manualDrug.strength} {selectedDrug?.strengthUnit || manualDrug.strengthUnit} - {selectedDrug?.form || manualDrug.form}
                    </div>
                    
                    {/* NDC */}
                    <div style={{ marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600' }}>NDC: </span>
                      {selectedDrug?.ndcId || manualDrug.ndcId}
                    </div>
                    
                    {/* Quantity */}
                    <div style={{ marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600' }}>Qty: </span>
                      {totalQuantity}
                    </div>
                    
                    {/* Expiry - Required by US Law */}
                    <div style={{ marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600' }}>EXP: </span>
                      {expiryDate ? new Date(expiryDate).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }) : 'N/A'}
                    </div>
                    
                    {/* Lot/Source */}
                    <div style={{ marginBottom: '2px' }}>
                      <span style={{ fontWeight: '600' }}>LOT: </span>
                      {lotSource || 'N/A'}
                    </div>
                    
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
            
            <Group justify="center">
              <Button leftSection={<IconPrinter size={16} />} onClick={() => handlePrint()}>
                Print Label
              </Button>
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
