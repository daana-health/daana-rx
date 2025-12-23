'use client';

import { useState } from 'react';
import { Loader2, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RelatedMedication {
  rxcui: string;
  name: string;
  relationship: string;
  description?: string;
}

interface RelatedMedicationsProps {
  drugName: string;
  onSelectMedication: (medicationName: string) => void;
}

export function RelatedMedications({ drugName, onSelectMedication }: RelatedMedicationsProps) {
  const [loading, setLoading] = useState(false);
  const [relatedMeds, setRelatedMeds] = useState<RelatedMedication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchRelatedMedications = async () => {
    if (!drugName || drugName.length < 2) {
      setError('Please enter a valid drug name');
      return;
    }

    setLoading(true);
    setError(null);
    setRelatedMeds([]);

    try {
      const response = await fetch(
        `/api/drugs/related?drug=${encodeURIComponent(drugName)}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch related medications');
      }

      const data = await response.json();
      
      if (data.success && data.related) {
        setRelatedMeds(data.related);
        setHasSearched(true);
        
        if (data.related.length === 0) {
          setError('No related medications found. This may be due to limited data in RxNorm for this drug.');
        }
      } else {
        setError(data.error || 'Failed to load related medications');
      }
    } catch (err) {
      console.error('Error fetching related medications:', err);
      setError('Failed to load related medications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRelationshipBadge = (relationship: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
      same_class: { variant: 'default', label: 'Same Class' },
      alternative: { variant: 'secondary', label: 'Alternative' },
      contains_ingredient: { variant: 'outline', label: 'Related Ingredient' },
    };

    const config = variants[relationship] || { variant: 'outline' as const, label: relationship };
    return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          Related Medications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button
            onClick={fetchRelatedMedications}
            disabled={loading || !drugName}
            size="sm"
            className="flex-1"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Find Related Medications
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {hasSearched && relatedMeds.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Found {relatedMeds.length} related medication(s) for <span className="font-semibold">{drugName}</span>:
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {relatedMeds.map((med) => (
                <Card
                  key={med.rxcui}
                  className="p-3 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => onSelectMedication(med.name)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{med.name}</p>
                      {med.description && (
                        <p className="text-xs text-muted-foreground mt-1">{med.description}</p>
                      )}
                    </div>
                    {getRelationshipBadge(med.relationship)}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {hasSearched && relatedMeds.length === 0 && !error && (
          <Alert className="py-2">
            <AlertDescription className="text-sm">
              No related medications found. Try searching for the generic name of the drug.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

