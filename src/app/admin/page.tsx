'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Loader2, Settings } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { GetLocationsResponse, LocationData } from '../../types/graphql';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const GET_LOCATIONS = gql`
  query GetLocations {
    getLocations {
      locationId
      name
      temp
      createdAt
    }
  }
`;

const CREATE_LOCATION = gql`
  mutation CreateLocation($input: CreateLocationInput!) {
    createLocation(input: $input) {
      locationId
      name
      temp
    }
  }
`;

const UPDATE_LOCATION = gql`
  mutation UpdateLocation($input: UpdateLocationInput!) {
    updateLocation(input: $input) {
      locationId
      name
      temp
    }
  }
`;

const DELETE_LOCATION = gql`
  mutation DeleteLocation($locationId: ID!) {
    deleteLocation(locationId: $locationId)
  }
`;

const GET_CLINIC = gql`
  query GetClinic {
    getClinic {
      clinicId
      name
      requireLotLocation
    }
  }
`;

const UPDATE_CLINIC = gql`
  mutation UpdateClinic($input: UpdateClinicInput!) {
    updateClinic(input: $input) {
      clinicId
      requireLotLocation
    }
  }
`;

export default function AdminPage() {
  const { toast } = useToast();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationData | null>(null);
  const [name, setName] = useState('');
  const [temp, setTemp] = useState<string>('room_temp');
  const [requireLotLocation, setRequireLotLocation] = useState(false);

  const { data, refetch } = useQuery<GetLocationsResponse>(GET_LOCATIONS);
  const { data: clinicData, refetch: refetchClinic } = useQuery(GET_CLINIC);

  // Initialize requireLotLocation from clinic data
  useEffect(() => {
    if (clinicData?.getClinic?.requireLotLocation !== undefined) {
      setRequireLotLocation(clinicData.getClinic.requireLotLocation);
    }
  }, [clinicData]);

  const [createLocation, { loading: creating }] = useMutation(CREATE_LOCATION, {
    onCompleted: () => {
      toast({
        title: 'Success',
        description: 'Location created successfully',
      });
      setModalOpened(false);
      setName('');
      setTemp('room_temp');
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [updateLocation, { loading: updating }] = useMutation(UPDATE_LOCATION, {
    onCompleted: () => {
      toast({
        title: 'Success',
        description: 'Location updated successfully',
      });
      setModalOpened(false);
      setEditingLocation(null);
      setName('');
      setTemp('room_temp');
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [deleteLocation] = useMutation(DELETE_LOCATION, {
    onCompleted: () => {
      toast({
        title: 'Success',
        description: 'Location deleted successfully',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [updateClinic, { loading: updatingClinic }] = useMutation(UPDATE_CLINIC, {
    onCompleted: () => {
      toast({
        title: 'Success',
        description: 'Clinic settings updated',
      });
      refetchClinic();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleRequireLotLocationChange = (checked: boolean) => {
    setRequireLotLocation(checked);
    updateClinic({
      variables: {
        input: {
          requireLotLocation: checked,
        },
      },
    });
  };

  const handleSubmit = () => {
    if (editingLocation) {
      updateLocation({
        variables: {
          input: {
            locationId: editingLocation.locationId,
            name,
            temp: temp as 'fridge' | 'room_temp',
          },
        },
      });
    } else {
      createLocation({
        variables: {
          input: {
            name,
            temp: temp as 'fridge' | 'room_temp',
          },
        },
      });
    }
  };

  const handleEdit = (location: LocationData) => {
    setEditingLocation(location);
    setName(location.name);
    setTemp(location.temp === 'room temp' ? 'room_temp' : 'fridge');
    setModalOpened(true);
  };

  const handleDelete = (locationId: string) => {
    if (confirm('Are you sure you want to delete this location?')) {
      deleteLocation({ variables: { locationId } });
    }
  };

  const openCreateModal = () => {
    setEditingLocation(null);
    setName('');
    setTemp('room_temp');
    setModalOpened(true);
  };

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Admin</h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Manage locations and clinic settings
            </p>
          </div>
          <Button onClick={openCreateModal} size="lg" className="w-full sm:w-auto">Create Location</Button>
        </div>

        {/* Clinic Settings Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle className="text-2xl">Clinic Settings</CardTitle>
            </div>
            <CardDescription>Configure your clinic preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="require-lot-location" className="text-base font-semibold">
                  Require Location (L/R) for Lot Codes
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, users must specify Left (L) or Right (R) when creating new lots
                </p>
              </div>
              <Switch
                id="require-lot-location"
                checked={requireLotLocation}
                onCheckedChange={handleRequireLotLocationChange}
                disabled={updatingClinic}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl">Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.getLocations && data.getLocations.length > 0 ? (
              <div className="overflow-x-auto -mx-6 sm:-mx-6">
                <div className="inline-block min-w-full align-middle">
                  <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold min-w-[120px]">Name</TableHead>
                      <TableHead className="font-semibold min-w-[100px]">Temperature</TableHead>
                      <TableHead className="font-semibold hidden sm:table-cell min-w-[100px]">Created</TableHead>
                      <TableHead className="font-semibold min-w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.getLocations.map((location: LocationData) => (
                      <TableRow key={location.locationId} className="hover:bg-accent/50">
                        <TableCell className="font-semibold break-words">{location.name}</TableCell>
                        <TableCell className="capitalize font-medium text-sm">{location.temp.replace('_', ' ')}</TableCell>
                        <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{new Date(location.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(location)} className="w-full sm:w-auto">
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(location.locationId)}
                              className="w-full sm:w-auto"
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            ) : (
              <p className="text-base text-muted-foreground text-center py-8">No locations created yet</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={modalOpened} onOpenChange={setModalOpened}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editingLocation ? 'Edit Location' : 'Create Location'}</DialogTitle>
              <DialogDescription className="text-base">
                {editingLocation ? 'Update the location details' : 'Add a new storage location for medications'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-3">
                <Label htmlFor="location-name" className="text-base font-semibold">Location Name *</Label>
                <Input
                  id="location-name"
                  placeholder="e.g., Main Refrigerator"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="temperature" className="text-base font-semibold">Temperature *</Label>
                <Select value={temp} onValueChange={setTemp}>
                  <SelectTrigger id="temperature">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fridge">Refrigerated (Fridge)</SelectItem>
                    <SelectItem value="room_temp">Room Temperature</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpened(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={creating || updating}>
                {(creating || updating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingLocation ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
