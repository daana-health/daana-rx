'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Mail, Trash2, Copy, Plus, Loader2 } from 'lucide-react';
import { RootState } from '../../store';
import { AppShell } from '../../components/layout/AppShell';
import { GetUsersResponse, UserData } from '../../types/graphql';
import { setAuth } from '../../store/authSlice';
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
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

const GET_USERS = gql`
  query GetUsers {
    getUsers {
      userId
      username
      email
      userRole
      createdAt
    }
  }
`;

const GET_INVITATIONS = gql`
  query GetInvitations {
    getInvitations {
      invitationId
      email
      userRole
      status
      invitationToken
      createdAt
      expiresAt
      acceptedAt
      invitedByUser {
        username
        email
      }
    }
  }
`;

const SEND_INVITATION = gql`
  mutation SendInvitation($input: SendInvitationInput!) {
    sendInvitation(input: $input) {
      invitationId
      email
      status
      invitationToken
    }
  }
`;

const RESEND_INVITATION = gql`
  mutation ResendInvitation($invitationId: ID!) {
    resendInvitation(invitationId: $invitationId) {
      invitationId
      email
    }
  }
`;

const CANCEL_INVITATION = gql`
  mutation CancelInvitation($invitationId: ID!) {
    cancelInvitation(invitationId: $invitationId)
  }
`;

const CREATE_CLINIC = gql`
  mutation CreateClinic($input: CreateClinicInput!) {
    createClinic(input: $input) {
      token
      user {
        userId
        username
        email
        clinicId
        userRole
      }
      clinic {
        clinicId
        name
        primaryColor
        secondaryColor
        logoUrl
      }
    }
  }
`;

export default function SettingsPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { toast } = useToast();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isSuperadmin = currentUser?.userRole === 'superadmin';

  const [modalOpened, setModalOpened] = useState(false);
  const [email, setEmail] = useState('');
  const [userRole, setUserRole] = useState('employee');
  const [createClinicModalOpened, setCreateClinicModalOpened] = useState(false);
  const [newClinicName, setNewClinicName] = useState('');
  const [password, setPassword] = useState('');

  const { data: usersData } = useQuery<GetUsersResponse>(GET_USERS, {
    skip: !isSuperadmin,
  });

  const { data: invitationsData, refetch: refetchInvitations } = useQuery(GET_INVITATIONS, {
    skip: !isSuperadmin,
  });

  const [sendInvitation, { loading }] = useMutation(SEND_INVITATION, {
    onCompleted: () => {
      toast({
        title: 'Success',
        description: 'Invitation sent successfully',
      });
      setModalOpened(false);
      setEmail('');
      setUserRole('employee');
      refetchInvitations();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [resendInvitation] = useMutation(RESEND_INVITATION, {
    onCompleted: () => {
      toast({
        title: 'Success',
        description: 'Invitation resent successfully',
      });
      refetchInvitations();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [cancelInvitation] = useMutation(CANCEL_INVITATION, {
    onCompleted: () => {
      toast({
        title: 'Success',
        description: 'Invitation cancelled successfully',
      });
      refetchInvitations();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [createClinic, { loading: createClinicLoading }] = useMutation(CREATE_CLINIC, {
    onCompleted: (data) => {
      dispatch(
        setAuth({
          user: data.createClinic.user,
          clinic: data.createClinic.clinic,
          token: data.createClinic.token,
        })
      );

      toast({
        title: 'Success',
        description: `Clinic "${data.createClinic.clinic.name}" created successfully!`,
      });

      setCreateClinicModalOpened(false);
      setNewClinicName('');
      setPassword('');
      router.push('/');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSendInvitation = () => {
    if (!email || !userRole) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    sendInvitation({
      variables: {
        input: {
          email,
          userRole,
        },
      },
    });
  };

  const handleResend = (invitationId: string) => {
    resendInvitation({
      variables: { invitationId },
    });
  };

  const handleCancel = (invitationId: string) => {
    cancelInvitation({
      variables: { invitationId },
    });
  };

  const handleCreateClinic = () => {
    if (!newClinicName || !password) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    createClinic({
      variables: {
        input: {
          name: newClinicName,
          password,
        },
      },
    });
  };

  const copyInvitationLink = (invitationToken: string, email: string) => {
    const invitationUrl = `${window.location.origin}/auth/signup?invitation=${invitationToken}`;

    navigator.clipboard.writeText(invitationUrl).then(() => {
      toast({
        title: 'Link Copied!',
        description: `Invitation link for ${email} copied to clipboard`,
      });
    }).catch(() => {
      toast({
        title: 'Copy Failed',
        description: invitationUrl,
        variant: 'destructive',
      });
    });
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" => {
    if (status === 'accepted') return 'default';
    if (status === 'expired') return 'destructive';
    return 'secondary';
  };

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Settings</h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              {isSuperadmin ? "Manage users and clinic configuration" : "Create and manage your clinics"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => setCreateClinicModalOpened(true)}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create New Clinic
            </Button>
            {isSuperadmin && (
              <Button onClick={() => setModalOpened(true)} size="lg" className="w-full sm:w-auto">
                Send Invitation
              </Button>
            )}
          </div>
        </div>

        {/* Invitations Card - Superadmin only */}
        {isSuperadmin && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl">Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              {invitationsData?.getInvitations && invitationsData.getInvitations.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Invited By</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitationsData.getInvitations.map((invitation: any) => (
                        <TableRow key={invitation.invitationId}>
                          <TableCell className="font-medium">{invitation.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{invitation.userRole}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(invitation.status)}>
                              {invitation.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{invitation.invitedByUser.username}</TableCell>
                          <TableCell className="text-sm">{new Date(invitation.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {invitation.status === 'invited' ? (
                              <span className="text-sm">
                                {new Date(invitation.expiresAt).toLocaleDateString()}
                              </span>
                            ) : invitation.acceptedAt ? (
                              <span className="text-sm text-green-600">
                                Accepted {new Date(invitation.acceptedAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-sm text-red-600">
                                Expired
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {invitation.status === 'invited' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => copyInvitationLink(invitation.invitationToken, invitation.email)}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy invitation link</TooltipContent>
                                  </Tooltip>
                                  
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleResend(invitation.invitationId)}
                                      >
                                        <Mail className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Resend invitation</TooltipContent>
                                  </Tooltip>
                                  
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleCancel(invitation.invitationId)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Cancel invitation</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pending invitations</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Users Card - Superadmin only */}
        {isSuperadmin && (
          <Card>
            <CardHeader>
              <CardTitle>Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              {usersData?.getUsers && usersData.getUsers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData.getUsers.map((user: UserData) => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.userRole}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No users found</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invitation Modal - Superadmin only */}
        {isSuperadmin && (
          <Dialog open={modalOpened} onOpenChange={setModalOpened}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Send Invitation</DialogTitle>
                <DialogDescription>
                  Send an invitation email to a new user. They will receive a link to create their
                  account and join your clinic.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The user will receive an invitation email at this address
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-role">User Role *</Label>
                  <Select value={userRole} onValueChange={setUserRole}>
                    <SelectTrigger id="user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Admin can manage users, Employee has limited access
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalOpened(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendInvitation} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Create New Clinic Modal */}
        <Dialog open={createClinicModalOpened} onOpenChange={setCreateClinicModalOpened}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Clinic</DialogTitle>
              <DialogDescription>
                Create a new clinic and become its superadmin. You'll be able to switch between your clinics using the clinic switcher in the top left.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-name">Clinic Name *</Label>
                <Input
                  id="clinic-name"
                  placeholder="My New Clinic"
                  value={newClinicName}
                  onChange={(e) => setNewClinicName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Choose a name for your new clinic
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verify-password">Your Password *</Label>
                <Input
                  id="verify-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Verify your identity by entering your account password
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateClinicModalOpened(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateClinic} disabled={createClinicLoading}>
                {createClinicLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Clinic
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
