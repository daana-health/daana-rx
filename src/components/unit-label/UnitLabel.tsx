import { QRCodeSVG } from 'qrcode.react';

type UnitLabelProps = {
  unitId: string;
  medicationName: string;
  genericName?: string | null;
  strength?: number | string | null;
  strengthUnit?: string | null;
  form?: string | null;
  ndcId?: string | null;
  manufacturerLotNumber?: string | null;
  availableQuantity: number | string;
  totalQuantity: number | string;
  expiryDate?: string | Date | null;
  donationSource?: string | null;
  locationName?: string | null;
};

function formatExpiryMMYYYY(expiryDate?: string | Date | null) {
  if (!expiryDate) return 'N/A';
  const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' });
}

export function UnitLabel({
  unitId,
  medicationName,
  genericName,
  strength,
  strengthUnit,
  form,
  ndcId,
  manufacturerLotNumber,
  availableQuantity,
  totalQuantity,
  expiryDate,
  donationSource,
  locationName,
}: UnitLabelProps) {
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid #ddd',
        padding: '12px',
        backgroundColor: 'white',
        fontFamily: 'Arial, sans-serif',
        width: '384px',
        height: '192px',
        boxSizing: 'border-box',
      }}
    >
      {/* QR Code - Left Side */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingRight: '12px',
          borderRight: '1px solid #ddd',
          minWidth: '130px',
        }}
      >
        <QRCodeSVG value={unitId} size={100} level="H" />
        <div
          style={{
            fontSize: '6px',
            marginTop: '4px',
            textAlign: 'center',
            wordBreak: 'break-all',
            maxWidth: '100px',
            lineHeight: 1.2,
          }}
        >
          {unitId}
        </div>
      </div>

      {/* Label Information - Right Side */}
      <div
        style={{
          flex: 1,
          paddingLeft: '12px',
          fontSize: '9px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '8px',
            fontWeight: 'bold',
            backgroundColor: '#dc2626',
            color: 'white',
            padding: '2px 4px',
            marginBottom: '3px',
            textAlign: 'center',
            borderRadius: '2px',
          }}
        >
          DONATED MEDICATION
        </div>

        <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: 1.1, marginBottom: '1px' }}>
          {medicationName}
        </div>
        {genericName && (
          <div style={{ fontSize: '9px', color: '#666', marginBottom: '3px' }}>({genericName})</div>
        )}

        {(strength || form) && (
          <div style={{ fontSize: '10px', fontWeight: 600, marginBottom: '3px' }}>
            {strength && strengthUnit ? `${strength} ${strengthUnit}` : ''}{strength && form ? ' - ' : ''}{form || ''}
          </div>
        )}

        {ndcId && (
          <div style={{ marginBottom: '2px', fontSize: '8px' }}>
            <span style={{ fontWeight: 600 }}>NDC: </span>
            {ndcId}
          </div>
        )}

        <div style={{ marginBottom: '2px', fontSize: '8px' }}>
          <span style={{ fontWeight: 600 }}>Mfr Lot#: </span>
          {manufacturerLotNumber || 'NOT RECORDED'}
        </div>

        <div style={{ marginBottom: '2px', fontSize: '8px' }}>
          <span style={{ fontWeight: 600 }}>Qty: </span>
          {availableQuantity} / {totalQuantity}
        </div>

        <div style={{ marginBottom: '2px', fontSize: '8px' }}>
          <span style={{ fontWeight: 600 }}>EXP: </span>
          {formatExpiryMMYYYY(expiryDate)}
        </div>

        <div style={{ marginBottom: '2px', fontSize: '8px' }}>
          <span style={{ fontWeight: 600 }}>Source: </span>
          {donationSource || 'N/A'}
        </div>

        {locationName && (
          <div style={{ fontSize: '7px', color: '#666' }}>
            Store: {locationName}
          </div>
        )}

        <div
          style={{
            fontSize: '6px',
            color: '#888',
            marginTop: 'auto',
            borderTop: '1px solid #eee',
            paddingTop: '2px',
          }}
        >
          DaanaRX • For Clinic Use Only • FDA-Tracked Medication
        </div>
      </div>
    </div>
  );
}

