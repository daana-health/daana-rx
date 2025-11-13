import React, { useState, useEffect } from 'react';
import { YStack, XStack, Button, Input, TextArea, Label, Text, H2, Card } from 'tamagui';
import { Camera, Package, MapPin, Calendar, Hash, Info } from 'lucide-react';
import { ViewType, Unit } from '../../types';
import { useFirebase } from '../../context/FirebaseContext';
import { doc, writeBatch, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Modal from '../shared/Modal';
import ConfirmModal from '../shared/ConfirmModal';
import BarcodeScanner from '../shared/BarcodeScanner';
import UnitPreviewModal from '../shared/UnitPreviewModal';
import { useToast } from '../../context/ToastContext';

interface CheckOutProps {
  onNavigate: (view: ViewType) => void;
  prefilledDaanaId?: string;
}

const CheckOut: React.FC<CheckOutProps> = ({ onNavigate, prefilledDaanaId }) => {
  const { units, userId, locations } = useFirebase();
  const toast = useToast();
  
  const [daanaId, setDaanaId] = useState<string>('');
  const [qty, setQty] = useState<string>('');
  const [patientRef, setPatientRef] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [qtyError, setQtyError] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUnit, setPreviewUnit] = useState<Unit | null>(null);
  const [previewLocationName, setPreviewLocationName] = useState('');
  const [confirmedUnit, setConfirmedUnit] = useState<Unit | null>(null);
  const [confirmedLocationName, setConfirmedLocationName] = useState('');

  // Reset form when component unmounts or navigates away
  useEffect(() => {
    return () => {
      resetForm();
    };
  }, []);

  // Handle prefilled Daana ID from QR scan
  useEffect(() => {
    if (prefilledDaanaId) {
      handleUnitLookup(prefilledDaanaId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledDaanaId]);

  const resetForm = () => {
    setDaanaId('');
    setQty('');
    setPatientRef('');
    setReason('');
    setAvailableQty(null);
    setQtyError('');
    setConfirmedUnit(null);
    setConfirmedLocationName('');
  };

  const handleUnitLookup = async (daanaIdToLookup: string) => {
    // Don't lookup if empty
    if (!daanaIdToLookup || !daanaIdToLookup.trim()) {
      return;
    }

    // Try to parse as QR code JSON
    let parsedData: any = null;
    let extractedDaanaId = daanaIdToLookup.trim();
    
    try {
      parsedData = JSON.parse(daanaIdToLookup);
      if (parsedData.u) {
        extractedDaanaId = parsedData.u;
        console.log('✅ Extracted Daana ID from QR:', extractedDaanaId);
      }
    } catch {
      // Not JSON, use as-is
      console.log('🔍 Using as plain Daana ID:', extractedDaanaId);
    }

    // Find the unit to get display name
    let unit = units.find(u => u.daana_id === extractedDaanaId);
    
    if (!unit) {
      // Try database lookup
      const q = query(collection(db, 'units'), where('daana_id', '==', extractedDaanaId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty && querySnapshot.docs[0]) {
        const foundDoc = querySnapshot.docs[0];
        unit = { id: foundDoc.id, ...foundDoc.data() } as Unit;
      }
    }
    
    if (unit) {
      // Show preview modal with unit details
      const locationName = locations.find(l => l.id === unit!.location_id)?.name || 'Unknown';
      console.log('✅ Showing preview modal for unit:', unit.daana_id);
      setPreviewUnit(unit);
      setPreviewLocationName(locationName);
      setShowPreviewModal(true);
    } else {
      setAvailableQty(null);
      showInfoModal('Error', 'Daana ID not found.');
    }
  };

  const handleQtyChange = (value: string) => {
    setQty(value);
    
    // Validate quantity in real-time
    const qtyNum = parseInt(value, 10);
    
    if (value && isNaN(qtyNum)) {
      setQtyError('Please enter a valid number');
    } else if (qtyNum <= 0) {
      setQtyError('Quantity must be greater than 0');
    } else if (availableQty !== null && qtyNum > availableQty) {
      setQtyError(`Cannot exceed available quantity (${availableQty})`);
    } else {
      setQtyError('');
    }
  };

  const handleBarcodeScanned = async (barcode: string) => {
    console.log('📷 Barcode scanned:', barcode);
    
    // Ignore empty scans or very short scans (likely noise)
    if (!barcode || !barcode.trim() || barcode.trim().length < 3) {
      console.log('❌ Invalid/empty barcode, ignoring:', barcode);
      return;
    }
    
    // Try to parse QR code JSON
    let extractedDaanaId = barcode.trim();
    try {
      const parsedData = JSON.parse(barcode);
      if (parsedData.u) {
        extractedDaanaId = parsedData.u;
        console.log('✅ Extracted Daana ID from QR:', extractedDaanaId);
      }
    } catch {
      // Not JSON, use as-is
      console.log('🔍 Using as plain Daana ID:', extractedDaanaId);
    }
    
    // Find the unit
    let unit: Unit | null = null;
    const q = query(collection(db, 'units'), where('daana_id', '==', extractedDaanaId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty && querySnapshot.docs[0]) {
      const foundDoc = querySnapshot.docs[0];
      unit = { id: foundDoc.id, ...foundDoc.data() } as Unit;
    } else {
      // Try by qr_code_value as fallback
      const qrQuery = query(collection(db, 'units'), where('qr_code_value', '==', barcode));
      const qrSnapshot = await getDocs(qrQuery);

      if (!qrSnapshot.empty && qrSnapshot.docs[0]) {
        const foundDoc = qrSnapshot.docs[0];
        unit = { id: foundDoc.id, ...foundDoc.data() } as Unit;
      }
    }

    // Only show modal if unit was found - silently ignore not found
    if (unit) {
      // Show preview modal
      const locationName = locations.find(l => l.id === unit!.location_id)?.name || 'Unknown';
      console.log('✅ Showing preview modal for unit:', unit.daana_id);
      setPreviewUnit(unit);
      setPreviewLocationName(locationName);
      setShowScanner(false); // Close scanner first
      setTimeout(() => {
        setShowPreviewModal(true);
      }, 100); // Small delay to ensure scanner closes first
    } else {
      // Unit not found - just log it, don't show error modal
      console.log('⚠️ Unit not found for barcode:', barcode);
    }
  };
  
  const handlePreviewConfirm = () => {
    // After confirming preview, populate the checkout form and keep daana_id
    if (previewUnit) {
      setDaanaId(previewUnit.daana_id);
      setAvailableQty(previewUnit.qty_total);
      setConfirmedUnit(previewUnit); // Store confirmed unit for display
      setConfirmedLocationName(previewLocationName);
    }
  };
  
  const handleManualLookup = async () => {
    // Manual lookup when user clicks the lookup button
    if (!daanaId || !daanaId.trim()) {
      return;
    }
    
    const trimmedId = daanaId.trim();
    
    // Try to parse as QR code JSON
    let extractedDaanaId = trimmedId;
    try {
      const parsedData = JSON.parse(trimmedId);
      if (parsedData.u) {
        extractedDaanaId = parsedData.u;
      }
    } catch {
      // Not JSON, use as-is
    }
    
    // Find the unit
    let unit = units.find(u => u.daana_id === extractedDaanaId);
    
    if (!unit) {
      // Try database lookup
      const q = query(collection(db, 'units'), where('daana_id', '==', extractedDaanaId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty && querySnapshot.docs[0]) {
        const foundDoc = querySnapshot.docs[0];
        unit = { id: foundDoc.id, ...foundDoc.data() } as Unit;
      }
    }
    
    if (unit) {
      // Show preview modal
      const locationName = locations.find(l => l.id === unit!.location_id)?.name || 'Unknown';
      setPreviewUnit(unit);
      setPreviewLocationName(locationName);
      setShowPreviewModal(true);
    } else {
      showInfoModal('Error', 'Daana ID not found.');
    }
  };

  const showInfoModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setShowModal(true);
  };

  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for quantity validation errors
    if (qtyError) {
      showInfoModal('Validation Error', qtyError);
      return;
    }
    
    const daanaIdToFind = daanaId.trim();
    const qtyToDispense = parseInt(qty, 10);
    
    // Find unit
    let unit = units.find(u => u.daana_id === daanaIdToFind);
    let docId = unit?.id;
    
    if (!unit) {
      const q = query(collection(db, 'units'), where('daana_id', '==', daanaIdToFind));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty || !querySnapshot.docs[0]) {
        showInfoModal('Error', 'Daana ID not found.');
        return;
      }
      
      const foundDoc = querySnapshot.docs[0];
      unit = { id: foundDoc.id, ...foundDoc.data() } as Unit;
      docId = foundDoc.id;
    }
    
    // Validation
    if (qtyToDispense <= 0) {
      showInfoModal('Error', 'Quantity must be greater than 0.');
      return;
    }
    
    if (['dispensed', 'discarded', 'expired', 'quarantined'].includes(unit.status)) {
      showInfoModal('Error', `Cannot dispense. Unit status is: ${unit.status}.`);
      return;
    }
    
    const newQty = unit.qty_total - qtyToDispense;
    if (newQty < 0) {
      showInfoModal('Error', `Cannot dispense. Requested ${qtyToDispense}, but only ${unit.qty_total} available.`);
      return;
    }
    
    // FEFO Check - Query Firestore directly for accuracy
    let olderUnit: Unit | undefined;
    if (unit) {
      const currentUnit = unit; // Store in const to satisfy TypeScript
      try {
        const fefoQuery = query(
          collection(db, 'units'),
          where('med_generic', '==', currentUnit.med_generic),
          where('strength', '==', currentUnit.strength),
          where('status', 'in', ['in_stock', 'partial'])
        );
        const fefoSnapshot = await getDocs(fefoQuery);

        // Find units with earlier expiration dates
        fefoSnapshot.forEach((doc) => {
          const potentialUnit = { id: doc.id, ...doc.data() } as Unit;
          if (potentialUnit.id !== docId && potentialUnit.exp_date < currentUnit.exp_date) {
            if (!olderUnit || potentialUnit.exp_date < olderUnit.exp_date) {
              olderUnit = potentialUnit;
            }
          }
        });
      } catch (error) {
        console.error('Error checking FEFO:', error);
        // Fall back to context-based check if Firestore query fails
        olderUnit = units.find(u =>
          u.id !== docId &&
          u.med_generic === currentUnit.med_generic &&
          u.strength === currentUnit.strength &&
          (u.status === 'in_stock' || u.status === 'partial') &&
          u.exp_date < currentUnit.exp_date
        );
      }
    }
    
    const proceedWithCheckout = async () => {
      try {
        const batch = writeBatch(db);
        
        const unitRef = doc(db, 'units', docId!);
        
        if (newQty === 0) {
          // Delete unit from database when quantity reaches 0
          batch.delete(unitRef);
          console.log(`🗑️ Deleting unit ${unit!.daana_id} - quantity reached 0`);
        } else {
          // Update unit with new quantity
          batch.update(unitRef, {
            qty_total: newQty,
            status: 'partial',
            updated_at: serverTimestamp()
          });
        }
        
        const txnRef = doc(collection(db, 'transactions'));
        batch.set(txnRef, {
          daana_id: unit!.daana_id,
          type: 'check_out',
          qty: qtyToDispense,
          by_user_id: userId,
          patient_ref: patientRef,
          reason_note: reason,
          timestamp: serverTimestamp()
        });
        
        await batch.commit();

        const successMessage = newQty === 0
          ? `Dispensed all ${qtyToDispense} units. Unit removed from inventory.`
          : `Dispensed ${qtyToDispense} units. ${newQty} remaining.`;

        toast.success(successMessage, 4000);
        showInfoModal('Success', successMessage);
        
        // Reset form completely including daanaId input
        resetForm();
        setDaanaId('');
      } catch (error: any) {
        console.error('Error checking out:', error);
        showInfoModal('Error', `Could not dispense item: ${error.message}`);
      }
    };
    
    if (olderUnit) {
      setConfirmMessage(`This unit expires on ${unit.exp_date}. An older unit (exp: ${olderUnit.exp_date}) is available. Proceed anyway?`);
      setConfirmCallback(() => proceedWithCheckout);
      setShowConfirmModal(true);
    } else {
      await proceedWithCheckout();
    }
  };

  return (
    <YStack flex={1} space="$4" paddingVertical="$4">
      <Button 
        onPress={() => {
          resetForm();
          setDaanaId('');
          onNavigate('home');
        }}
        backgroundColor="$gray"
        color="white"
        size="$4"
        alignSelf="flex-start"
        hoverStyle={{ backgroundColor: "#4b5563" }}
        pressStyle={{ backgroundColor: "#374151" }}
        icon={<Text>←</Text>}
        $xs={{ width: "100%" }}
      >
        Back to Home
      </Button>
      
      <H2 fontSize="$9" fontWeight="600" color="$color" $xs={{ fontSize: "$8" }}>
        Check Out Stock
      </H2>
      
      {/* Confirmed Unit Summary Card */}
      {confirmedUnit && (
        <Card 
          elevate 
          backgroundColor="$blue2" 
          borderWidth={2}
          borderColor="$blue8"
          padding="$4" 
          borderRadius="$4" 
          maxWidth={600} 
          width="100%" 
          marginHorizontal="auto"
          $xs={{ maxWidth: "100%" }}
        >
          <YStack space="$3">
            {/* Header */}
            <XStack alignItems="center" justifyContent="space-between" borderBottomWidth={1} borderBottomColor="$blue6" paddingBottom="$2">
              <Text fontSize="$5" fontWeight="600" color="$blue11">
                Selected Unit
              </Text>
              <Button
                size="$2"
                chromeless
                onPress={() => {
                  setConfirmedUnit(null);
                  setConfirmedLocationName('');
                  setDaanaId('');
                }}
                color="$blue11"
                hoverStyle={{ opacity: 0.7 }}
              >
                Clear
              </Button>
            </XStack>

            <YStack space="$2">
              {/* Medication Name */}
              <XStack alignItems="flex-start" space="$2">
                <Package size={18} color="var(--color-blue-10)" style={{ marginTop: 2 }} />
                <YStack flex={1}>
                  <Text fontSize="$6" fontWeight="600" color="$color">
                    {confirmedUnit.med_generic} {confirmedUnit.strength}
                  </Text>
                  <Text fontSize="$3" color="$gray11">{confirmedUnit.form}</Text>
                </YStack>
              </XStack>

              {/* Details Grid */}
              <XStack flexWrap="wrap" gap="$3" marginTop="$2">
                {/* Daana ID */}
                <XStack alignItems="center" space="$2" minWidth="45%">
                  <Hash size={16} color="var(--color-gray-10)" />
                  <YStack>
                    <Text fontSize="$1" color="$gray10" textTransform="uppercase">Daana ID</Text>
                    <Text fontSize="$3" fontFamily="$mono" color="$color">{confirmedUnit.daana_id}</Text>
                  </YStack>
                </XStack>

                {/* Available Quantity */}
                <XStack alignItems="center" space="$2" minWidth="45%">
                  <Info size={16} color="var(--color-green-10)" />
                  <YStack>
                    <Text fontSize="$1" color="$gray10" textTransform="uppercase">Available</Text>
                    <Text fontSize="$3" fontWeight="600" color="$green10">{confirmedUnit.qty_total} units</Text>
                  </YStack>
                </XStack>

                {/* Location */}
                <XStack alignItems="center" space="$2" minWidth="45%">
                  <MapPin size={16} color="var(--color-purple-10)" />
                  <YStack>
                    <Text fontSize="$1" color="$gray10" textTransform="uppercase">Location</Text>
                    <Text fontSize="$3" color="$color">{confirmedLocationName}</Text>
                  </YStack>
                </XStack>

                {/* Expiration */}
                <XStack alignItems="center" space="$2" minWidth="45%">
                  <Calendar size={16} color="var(--color-red-10)" />
                  <YStack>
                    <Text fontSize="$1" color="$gray10" textTransform="uppercase">Expires</Text>
                    <Text fontSize="$3" color="$color">{confirmedUnit.exp_date}</Text>
                  </YStack>
                </XStack>
              </XStack>

              {/* Low Stock Warning */}
              {confirmedUnit.qty_total < 5 && (
                <Card backgroundColor="rgba(245, 158, 11, 0.1)" padding="$2" borderWidth={1} borderColor="$yellow8" marginTop="$2">
                  <Text fontSize="$2" color="$yellow11" textAlign="center">
                    ⚠️ Low stock: Only {confirmedUnit.qty_total} units remaining
                  </Text>
                </Card>
              )}
            </YStack>
          </YStack>
        </Card>
      )}
      
      <Card 
        elevate 
        backgroundColor="$background" 
        padding="$6" 
        borderRadius="$4" 
        maxWidth={600} 
        width="100%" 
        marginHorizontal="auto"
        $xs={{ maxWidth: "100%" }}
      >
        <YStack space="$4" tag="form" onSubmit={(e: any) => { e.preventDefault(); handleCheckOut(e); }}>
          <YStack space="$2">
            <Label htmlFor="daanaId" fontSize="$3" fontWeight="500" color="$color">
              Scan DaanaRX Daana ID
            </Label>
            <XStack space="$2" $xs={{ flexDirection: "column" }}>
              <Input 
                id="daanaId"
                flex={1}
                size="$4"
                value={daanaId}
                onChangeText={(value: string) => {
                  setDaanaId(value);
                }}
                placeholder="Scan internal DaanaRX QR" 
                borderColor="$borderColor"
                focusStyle={{ borderColor: "$blue" }}
                $xs={{ width: "100%", marginBottom: "$2" }}
              />
              <Button 
                onPress={handleManualLookup}
                backgroundColor="$blue"
                color="white"
                size="$4"
                disabled={!daanaId || daanaId.trim().length === 0}
                hoverStyle={{ opacity: 0.9 }}
                pressStyle={{ opacity: 0.8 }}
                $xs={{ width: "100%", marginBottom: "$2" }}
              >
                Lookup
              </Button>
              <Button 
                onPress={() => setShowScanner(true)}
                backgroundColor="$green"
                color="white"
                size="$4"
                icon={<Camera size={20} />}
                hoverStyle={{ opacity: 0.9 }}
                pressStyle={{ opacity: 0.8 }}
                $xs={{ width: "100%" }}
              />
            </XStack>
          </YStack>
          
          <YStack space="$2">
            <Label htmlFor="qty" fontSize="$3" fontWeight="500" color="$color">
              Quantity to Dispense
              {availableQty !== null && (
                <Text fontSize="$2" color="$gray" marginLeft="$2">
                  (Available: {availableQty})
                </Text>
              )}
            </Label>
            <Input 
              id="qty"
              size="$4"
              value={qty}
              onChangeText={handleQtyChange}
              placeholder="e.g., 10"
              keyboardType="numeric"
              borderColor={qtyError ? "$red" : "$borderColor"}
              focusStyle={{ borderColor: qtyError ? "$red" : "$blue" }}
              required
              min={1}
              max={availableQty || undefined}
            />
            {qtyError && (
              <Text fontSize="$3" color="$red">{qtyError}</Text>
            )}
          </YStack>
          
          <YStack space="$2">
            <Label htmlFor="patientRef" fontSize="$3" fontWeight="500" color="$color">
              Patient Ref Code (No PHI)
            </Label>
            <Input 
              id="patientRef"
              size="$4"
              value={patientRef}
              onChangeText={setPatientRef}
              placeholder="e.g., JAX-2025-001"
              borderColor="$borderColor"
              focusStyle={{ borderColor: "$blue" }}
            />
          </YStack>
          
          <YStack space="$2">
            <Label htmlFor="reason" fontSize="$3" fontWeight="500" color="$color">
              Reason/Notes
            </Label>
            <TextArea 
              id="reason"
              size="$4"
              value={reason}
              onChangeText={setReason}
              numberOfLines={2}
              placeholder="e.g., Provider dispense"
              borderColor="$borderColor"
              focusStyle={{ borderColor: "$blue" }}
            />
          </YStack>
          
          <Button 
            type="submit"
            size="$5"
            disabled={!!qtyError}
            backgroundColor={qtyError ? "$gray" : "$yellow"}
            color={qtyError ? "#374151" : "white"}
            hoverStyle={{ opacity: qtyError ? 1 : 0.9 }}
            pressStyle={{ opacity: qtyError ? 1 : 0.8 }}
            cursor={qtyError ? "not-allowed" : "pointer"}
            opacity={qtyError ? 0.6 : 1}
          >
            Dispense Stock
          </Button>
        </YStack>
      </Card>
      
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalTitle}
      >
        <YStack space="$4">
          <Text paddingVertical="$4">{modalMessage}</Text>
          <XStack justifyContent="flex-end" paddingTop="$4" borderTopWidth={1} borderTopColor="$borderColor">
            <Button 
              onPress={() => setShowModal(false)}
              backgroundColor="$blue"
              color="white"
              size="$4"
              hoverStyle={{ opacity: 0.9 }}
              pressStyle={{ opacity: 0.8 }}
            >
              OK
            </Button>
          </XStack>
        </YStack>
      </Modal>
      
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          if (confirmCallback) confirmCallback();
        }}
        title="FEFO Warning"
        message={confirmMessage}
        confirmText="Proceed"
        confirmColor="blue"
      />
      
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScanned}
        title="Scan DaanaRX QR Code"
      />
      
      <UnitPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        onConfirm={handlePreviewConfirm}
        unit={previewUnit}
        locationName={previewLocationName}
      />
    </YStack>
  );
};

export default CheckOut;

