import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { CapacityBadge } from './CapacityBadge';

interface LotCapacityAlertProps {
  currentCapacity: number;
  maxCapacity: number;
  /** Optional: Show available capacity */
  showAvailable?: boolean;
  /** Optional: Variant for different contexts */
  variant?: 'info' | 'warning' | 'error';
}

/**
 * LotCapacityAlert - Displays lot capacity information in an alert box
 * 
 * Shows current capacity with color-coded badge and optional available capacity
 * Automatically determines alert color and icon based on capacity usage
 * 
 * @example
 * <LotCapacityAlert currentCapacity={50} maxCapacity={100} showAvailable />
 * // Shows: "Lot Capacity: 50/100 units (50 available)"
 */
export function LotCapacityAlert({ 
  currentCapacity, 
  maxCapacity,
  showAvailable = true,
  variant
}: LotCapacityAlertProps) {
  const availableCapacity = maxCapacity - currentCapacity;
  const percentage = maxCapacity > 0 ? (currentCapacity / maxCapacity) * 100 : 0;
  
  // Determine alert variant and icon based on capacity usage if variant not provided
  const alertVariant = variant === 'error' ? 'destructive' 
    : variant === 'warning' ? 'default'
    : variant === 'info' ? 'default'
    : percentage >= 100 ? 'destructive'
    : percentage >= 90 ? 'default'
    : 'default';

  const Icon = percentage >= 100 || variant === 'error' ? AlertCircle
    : percentage >= 90 || variant === 'warning' ? AlertTriangle
    : Info;

  return (
    <Alert variant={alertVariant}>
      <Icon className="h-4 w-4" />
      <AlertDescription>
        <div className="text-sm">
          <strong>Lot Capacity:</strong>{' '}
          <CapacityBadge 
            current={currentCapacity} 
            max={maxCapacity}
          />
        </div>
        {percentage >= 100 && (
          <div className="mt-2 text-sm font-medium">
            ⚠️ This lot is at full capacity. Please select a different lot.
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
