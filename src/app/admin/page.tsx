'use client';

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Loader2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { GetLocationsResponse, LocationData } from '../../types/graphql';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function AdminPage() {
  const { toast } = useToast();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationData | null>(null);
  const [name, setName] = useState('');
  const [temp, setTemp] = useState<string>('room_temp');

  const { data, refetch } = useQuery<GetLocationsResponse>(GET_LOCATIONS);

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

        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl">Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.getLocations && data.getLocations.length > 0 ? (
              <div className="overflow-x-auto -mx-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Temperature</TableHead>
                      <TableHead className="font-semibold">Created</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.getLocations.map((location: LocationData) => (
                      <TableRow key={location.locationId} className="hover:bg-accent/50">
                        <TableCell className="font-semibold">{location.name}</TableCell>
                        <TableCell className="capitalize font-medium">{location.temp.replace('_', ' ')}</TableCell>
                        <TableCell className="text-sm">{new Date(location.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(location)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(location.locationId)}
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
            ) : (
              <p className="text-base text-muted-foreground text-center py-8">No locations created yet</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={modalOpened} onOpenChange={setModalOpened}>
          <DialogContent className="sm:max-w-[500px]">
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
