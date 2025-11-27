import { supabaseServer, supabaseAuth } from '../utils/supabase';
import { generateToken } from '../utils/auth';
import type { Invitation } from '@/types';

export interface SendInvitationInput {
  email: string;
  userRole: string;
  clinicId: string;
  invitedBy: string;
}

export interface AcceptInvitationInput {
  invitationToken: string;
  password: string;
}

export const invitationService = {
  /**
   * Send an invitation to a user
   */
  async sendInvitation(input: SendInvitationInput): Promise<Invitation> {
    const { email, userRole, clinicId, invitedBy } = input;

    // Validate user role
    if (!['admin', 'employee'].includes(userRole)) {
      throw new Error('Invalid user role. Must be admin or employee.');
    }

    // Check if user already exists with this email
    const { data: existingUser } = await supabaseServer
      .from('users')
      .select('user_id, email, clinic_ids')
      .eq('email', email)
      .single();

    // If user exists, check if they're already in this clinic
    if (existingUser) {
      const clinicIds = existingUser.clinic_ids || [];
      if (clinicIds.includes(clinicId)) {
        throw new Error('User with this email already exists in this clinic.');
      }
    }

    // Check if there's already an active invitation
    const { data: existingInvitation } = await supabaseServer
      .from('invitations')
      .select('*')
      .eq('email', email)
      .eq('clinic_id', clinicId)
      .eq('status', 'invited')
      .single();

    // If there's an existing invitation, resend it
    if (existingInvitation) {
      // Update the expiry date
      const { data: updatedInvitation, error: updateError } = await supabaseServer
        .from('invitations')
        .update({
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        })
        .eq('invitation_id', existingInvitation.invitation_id)
        .select('*')
        .single();

      if (updateError) {
        throw new Error(`Failed to update invitation: ${updateError.message}`);
      }

      // Send the invitation email
      await this.sendInvitationEmail(email, updatedInvitation.invitation_token, clinicId);

      return this.formatInvitation(updatedInvitation);
    }

    // Create new invitation
    const { data: invitation, error } = await supabaseServer
      .from('invitations')
      .insert({
        email,
        clinic_id: clinicId,
        invited_by: invitedBy,
        user_role: userRole,
        status: 'invited',
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create invitation: ${error.message}`);
    }

    // Send the invitation email
    await this.sendInvitationEmail(email, invitation.invitation_token, clinicId);

    return this.formatInvitation(invitation);
  },

  /**
   * Send invitation email
   * NOTE: We can't use Supabase's inviteUserByEmail because it creates an auth user immediately.
   * For now, just log the invitation URL. You can integrate with an email service later.
   */
  async sendInvitationEmail(email: string, invitationToken: string, clinicId: string): Promise<void> {
    // Get clinic name for email branding
    const { data: clinic } = await supabaseServer
      .from('clinics')
      .select('name')
      .eq('clinic_id', clinicId)
      .single();

    const clinicName = clinic?.name || 'DaanaRx';

    // Create a signup link with invitation token
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/signup?invitation=${invitationToken}`;

    // Log the invitation URL for the admin to share
    console.log('\n=================================');
    console.log('📧 New Invitation Created');
    console.log('=================================');
    console.log('To:', email);
    console.log('Clinic:', clinicName);
    console.log('Invitation Link:', inviteUrl);
    console.log('=================================\n');

    // TODO: Integrate with an email service like Resend, SendGrid, or configure Supabase Functions
    // to send emails without creating auth users.
    //
    // Options:
    // 1. Use Resend.com (easiest):
    //    const resend = new Resend(process.env.RESEND_API_KEY);
    //    await resend.emails.send({
    //      from: 'noreply@yourdomain.com',
    //      to: email,
    //      subject: `You've been invited to ${clinicName}`,
    //      html: `<p>Click here to accept: <a href="${inviteUrl}">${inviteUrl}</a></p>`
    //    });
    //
    // 2. Use SendGrid
    // 3. Use AWS SES
    // 4. Use Supabase Edge Functions with a custom email API
    //
    // For now, the admin must manually share this link with the user.
  },

  /**
   * Get all invitations for a clinic
   */
  async getInvitations(clinicId: string): Promise<Invitation[]> {
    const { data: invitations, error } = await supabaseServer
      .from('invitations')
      .select(`
        *,
        invitedByUser:invited_by(user_id, username, email),
        clinic:clinic_id(clinic_id, name, primary_color, secondary_color, logo_url, created_at, updated_at)
      `)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch invitations: ${error.message}`);
    }

    return invitations.map(this.formatInvitation);
  },

  /**
   * Get invitation by token
   */
  async getInvitationByToken(invitationToken: string): Promise<Invitation | null> {
    const { data: invitation, error } = await supabaseServer
      .from('invitations')
      .select(`
        *,
        invitedByUser:invited_by(user_id, username, email),
        clinic:clinic_id(clinic_id, name, primary_color, secondary_color, logo_url, created_at, updated_at)
      `)
      .eq('invitation_token', invitationToken)
      .single();

    if (error || !invitation) {
      return null;
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseServer
        .from('invitations')
        .update({ status: 'expired' })
        .eq('invitation_id', invitation.invitation_id);

      throw new Error('This invitation has expired.');
    }

    return this.formatInvitation(invitation);
  },

  /**
   * Accept an invitation and create a user account or add existing user to clinic
   */
  async acceptInvitation(input: AcceptInvitationInput): Promise<{ user: any; token: string; clinic: any }> {
    const { invitationToken, password } = input;

    // Get the invitation
    const invitation = await this.getInvitationByToken(invitationToken);

    if (!invitation) {
      throw new Error('Invalid invitation token.');
    }

    if (invitation.status !== 'invited') {
      throw new Error('This invitation has already been used or expired.');
    }

    // Check if user already exists with this email
    const { data: existingUser } = await supabaseServer
      .from('users')
      .select('*')
      .eq('email', invitation.email)
      .single();

    let user: any;

    if (existingUser) {
      // User already exists - just add them to the new clinic
      // They need to sign in with their existing password to verify identity
      const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
        email: invitation.email,
        password,
      });

      if (signInError) {
        throw new Error('Invalid password. Please use your existing account password.');
      }

      user = existingUser;

      // Add user to the new clinic using the helper function
      const { error: addClinicError } = await supabaseServer.rpc('add_user_to_clinic', {
        p_user_id: existingUser.user_id,
        p_clinic_id: invitation.clinicId,
      });

      if (addClinicError) {
        throw new Error(`Failed to add user to clinic: ${addClinicError.message}`);
      }
    } else {
      // New user - create auth account and user record
      const { data: newAuthData, error: authError } = await supabaseServer.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true,
      });

      if (authError) {
        throw new Error(`Failed to create user: ${authError.message}`);
      }

      // Create the user record in the database
      const { data: newUser, error: userError } = await supabaseServer
        .from('users')
        .insert({
          user_id: newAuthData.user.id,
          email: invitation.email,
          username: invitation.email.split('@')[0],
          clinic_id: invitation.clinicId,
          active_clinic_id: invitation.clinicId,
          clinic_ids: [invitation.clinicId],
          user_role: invitation.userRole,
        })
        .select('*')
        .single();

      if (userError) {
        // Rollback: delete the auth user
        await supabaseServer.auth.admin.deleteUser(newAuthData.user.id);
        throw new Error(`Failed to create user record: ${userError.message}`);
      }

      user = newUser;

      // Add to clinic arrays using helper function
      const { error: addClinicError } = await supabaseServer.rpc('add_user_to_clinic', {
        p_user_id: newAuthData.user.id,
        p_clinic_id: invitation.clinicId,
      });

      if (addClinicError) {
        throw new Error(`Failed to add user to clinic: ${addClinicError.message}`);
      }

      // Sign in the new user to establish the session (we'll generate our own JWT)
      const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
        email: invitation.email,
        password,
      });

      if (signInError) {
        throw new Error(`Failed to sign in: ${signInError.message}`);
      }
    }

    // Mark invitation as accepted
    await supabaseServer
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('invitation_id', invitation.invitationId);

    // Get the clinic
    const { data: clinic, error: clinicError } = await supabaseServer
      .from('clinics')
      .select('*')
      .eq('clinic_id', invitation.clinicId)
      .single();

    if (clinicError) {
      throw new Error(`Failed to fetch clinic: ${clinicError.message}`);
    }

    // Fetch the updated user record to get the correct active_clinic_id
    const { data: updatedUser, error: updatedUserError } = await supabaseServer
      .from('users')
      .select('*')
      .eq('user_id', user.user_id)
      .single();

    if (updatedUserError || !updatedUser) {
      throw new Error(`Failed to fetch updated user: ${updatedUserError?.message}`);
    }

    // Generate JWT token with the correct clinic information
    const token = generateToken({
      userId: updatedUser.user_id,
      clinicId: invitation.clinicId, // Use the invited clinic as the active clinic
      userRole: invitation.userRole,
    });

    return {
      user: {
        userId: updatedUser.user_id,
        username: updatedUser.username,
        email: updatedUser.email,
        clinicId: invitation.clinicId, // Use the new clinic as the primary clinic
        activeClinicId: invitation.clinicId, // Set the new clinic as active
        userRole: invitation.userRole, // Use the role from the invitation
        createdAt: new Date(updatedUser.created_at),
        updatedAt: new Date(updatedUser.updated_at),
      },
      token,
      clinic: {
        clinicId: clinic.clinic_id,
        name: clinic.name,
        primaryColor: clinic.primary_color,
        secondaryColor: clinic.secondary_color,
        logoUrl: clinic.logo_url,
        createdAt: new Date(clinic.created_at),
        updatedAt: new Date(clinic.updated_at),
      },
    };
  },

  /**
   * Resend an invitation
   */
  async resendInvitation(invitationId: string, clinicId: string): Promise<Invitation> {
    const { data: invitation, error } = await supabaseServer
      .from('invitations')
      .select('*')
      .eq('invitation_id', invitationId)
      .eq('clinic_id', clinicId)
      .single();

    if (error || !invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.status !== 'invited') {
      throw new Error('Cannot resend an invitation that has been accepted or expired.');
    }

    // Update the expiry date
    const { data: updatedInvitation, error: updateError } = await supabaseServer
      .from('invitations')
      .update({
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      })
      .eq('invitation_id', invitationId)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(`Failed to resend invitation: ${updateError.message}`);
    }

    // Resend the email
    await this.sendInvitationEmail(
      updatedInvitation.email,
      updatedInvitation.invitation_token,
      updatedInvitation.clinic_id
    );

    return this.formatInvitation(updatedInvitation);
  },

  /**
   * Cancel an invitation
   */
  async cancelInvitation(invitationId: string, clinicId: string): Promise<boolean> {
    const { error } = await supabaseServer
      .from('invitations')
      .delete()
      .eq('invitation_id', invitationId)
      .eq('clinic_id', clinicId);

    if (error) {
      throw new Error(`Failed to cancel invitation: ${error.message}`);
    }

    return true;
  },

  /**
   * Format invitation data
   */
  formatInvitation(data: any): Invitation {
    return {
      invitationId: data.invitation_id,
      email: data.email,
      clinicId: data.clinic_id,
      clinic: data.clinic
        ? {
            clinicId: data.clinic.clinic_id,
            name: data.clinic.name,
            primaryColor: data.clinic.primary_color,
            secondaryColor: data.clinic.secondary_color,
            logoUrl: data.clinic.logo_url,
            createdAt: new Date(data.clinic.created_at),
            updatedAt: new Date(data.clinic.updated_at),
          }
        : undefined,
      invitedBy: data.invited_by,
      invitedByUser: data.invitedByUser
        ? {
            userId: data.invitedByUser.user_id,
            username: data.invitedByUser.username,
            email: data.invitedByUser.email,
          }
        : undefined,
      userRole: data.user_role,
      status: data.status,
      invitationToken: data.invitation_token,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      acceptedAt: data.accepted_at,
    };
  },
};

