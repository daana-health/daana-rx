import { supabaseServer, supabaseAuth } from '../utils/supabase';
import { generateToken } from '../utils/auth';
import { User, Clinic, AuthResponse } from '@/types';
import { emailService } from './emailService';

/**
 * Sign up a new user and create their clinic
 */
export async function signUp(email: string, password: string, clinicName: string): Promise<AuthResponse> {
  // Create auth user in Supabase Auth using service role to ensure immediate availability
  const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw new Error(`Sign up failed: ${authError?.message || 'Unknown error'}`);
  }

  const userId = authData.user.id;

  try {
    // Create clinic
    const { data: clinic, error: clinicError } = await supabaseServer
      .from('clinics')
      .insert({
        name: clinicName,
      })
      .select()
      .single();

    if (clinicError || !clinic) {
      throw new Error(`Failed to create clinic: ${clinicError?.message}`);
    }

    // Create user record
    const username = email.split('@')[0]; // Use email prefix as default username
    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .insert({
        user_id: userId,
        username,
        email,
        clinic_id: clinic.clinic_id,
        active_clinic_id: clinic.clinic_id,
        clinic_ids: [clinic.clinic_id],
        user_role: 'superadmin', // First user is superadmin
      })
      .select()
      .single();

    if (userError || !user) {
      throw new Error(`Failed to create user record: ${userError?.message}`);
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.user_id,
      clinicId: user.active_clinic_id || user.clinic_id,
      userRole: user.user_role,
    });

    // Send welcome email (don't await - send in background)
    emailService.sendWelcomeEmail({
      email: user.email,
      clinicName: clinic.name,
      username: user.username,
    }).catch(error => {
      console.error('Failed to send welcome email:', error);
      // Log but don't fail the signup
    });

    return {
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        password: '', // Never return password
        email: user.email,
        clinicId: user.clinic_id,
        activeClinicId: user.active_clinic_id || user.clinic_id,
        userRole: user.user_role,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      },
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
  } catch (error) {
    // Cleanup: delete auth user if clinic/user creation failed
    await supabaseServer.auth.admin.deleteUser(userId);
    throw error;
  }
}

/**
 * Sign in an existing user
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    console.log('Attempting sign in for email:', normalizedEmail);
    
    // Authenticate with Supabase Auth using anon key client
    // Service role key doesn't work properly with signInWithPassword
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError) {
      console.error('Auth error details:', {
        message: authError.message,
        status: authError.status,
        name: authError.name,
      });
      throw new Error(`Sign in failed: ${authError.message || 'Invalid credentials'}`);
    }

    if (!authData) {
      console.error('No auth data returned from signInWithPassword');
      throw new Error('Sign in failed: No authentication data returned');
    }

    if (!authData.user) {
      console.error('No user in auth data:', authData);
      throw new Error('Sign in failed: No user data returned');
    }

    const userId = authData.user.id;
    console.log('Authentication successful for user ID:', userId);

    // Get user record
    console.log('Fetching user record for user_id:', userId);
    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('User query error details:', {
        message: userError.message,
        code: userError.code,
        details: userError.details,
        hint: userError.hint,
      });
      throw new Error(`User record not found: ${userError.message}`);
    }

    if (!user) {
      console.error('User query returned null/undefined for user_id:', userId);
      throw new Error('User record not found');
    }

    console.log('User record found:', { userId: user.user_id, email: user.email, clinicId: user.clinic_id, activeClinicId: user.active_clinic_id });

    const effectiveClinicId: string = user.active_clinic_id || user.clinic_id;

    // Get clinic
    console.log('Fetching clinic record for clinic_id:', effectiveClinicId);
    const { data: clinic, error: clinicError } = await supabaseServer
      .from('clinics')
      .select('*')
      .eq('clinic_id', effectiveClinicId)
      .single();

    if (clinicError) {
      console.error('Clinic query error details:', {
        message: clinicError.message,
        code: clinicError.code,
        details: clinicError.details,
        hint: clinicError.hint,
      });
      throw new Error(`Clinic not found: ${clinicError.message}`);
    }

    if (!clinic) {
      console.error('Clinic query returned null/undefined for clinic_id:', user.clinic_id);
      throw new Error('Clinic not found');
    }

    console.log('Clinic record found:', { clinicId: clinic.clinic_id, name: clinic.name });

    // Generate JWT token
    const token = generateToken({
      userId: user.user_id,
      clinicId: effectiveClinicId,
      userRole: user.user_role,
    });

    return {
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        password: '',
        email: user.email,
        clinicId: user.clinic_id,
        activeClinicId: effectiveClinicId,
        userRole: user.user_role,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      },
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
  } catch (error: any) {
    console.error('Sign in error:', error);
    // Re-throw with a user-friendly message
    if (error.message) {
      throw error;
    }
    throw new Error(`Sign in failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const { data: user, error } = await supabaseServer
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !user) {
    return null;
  }

  return {
    userId: user.user_id,
    username: user.username,
    password: '',
    email: user.email,
    clinicId: user.clinic_id,
    activeClinicId: user.active_clinic_id || user.clinic_id,
    userRole: user.user_role,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at),
  };
}

/**
 * Get clinic by ID
 */
export async function getClinicById(clinicId: string): Promise<Clinic | null> {
  const { data: clinic, error } = await supabaseServer
    .from('clinics')
    .select('*')
    .eq('clinic_id', clinicId)
    .single();

  if (error || !clinic) {
    return null;
  }

  return {
    clinicId: clinic.clinic_id,
    name: clinic.name,
    primaryColor: clinic.primary_color,
    secondaryColor: clinic.secondary_color,
    logoUrl: clinic.logo_url,
    createdAt: new Date(clinic.created_at),
    updatedAt: new Date(clinic.updated_at),
  };
}

/**
 * Invite a new user to a clinic
 */
export async function inviteUser(
  email: string,
  username: string,
  userRole: 'admin' | 'employee',
  clinicId: string
): Promise<User> {
  // Generate a temporary password
  const tempPassword = Math.random().toString(36).slice(-12);

  // Create auth user
  const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create user: ${authError?.message}`);
  }

  const userId = authData.user.id;

  try {
    // Create user record
    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .insert({
        user_id: userId,
        username,
        email,
        clinic_id: clinicId,
        user_role: userRole,
      })
      .select()
      .single();

    if (userError || !user) {
      throw new Error(`Failed to create user record: ${userError?.message}`);
    }

    // TODO: Send email with invite link and temporary password
    // This would integrate with an email service like SendGrid or AWS SES

    return {
      userId: user.user_id,
      username: user.username,
      password: '',
      email: user.email,
      clinicId: user.clinic_id,
      userRole: user.user_role,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    };
  } catch (error) {
    // Cleanup
    await supabaseServer.auth.admin.deleteUser(userId);
    throw error;
  }
}

/**
 * Get all users for a clinic
 */
export async function getUsersByClinicId(clinicId: string): Promise<User[]> {
  const { data: users, error } = await supabaseServer
    .from('users')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get users: ${error.message}`);
  }

  return users.map((user) => ({
    userId: user.user_id,
    username: user.username,
    password: '',
    email: user.email,
    clinicId: user.clinic_id,
    userRole: user.user_role,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at),
  }));
}

/**
 * Check if an email exists in the database
 */
export async function checkEmailExists(email: string): Promise<{ exists: boolean; message: string }> {
  const { data: user } = await supabaseServer
    .from('users')
    .select('email')
    .eq('email', email.trim().toLowerCase())
    .single();

  if (user) {
    return {
      exists: true,
      message: 'An account with this email already exists. Please sign in instead.',
    };
  }

  return {
    exists: false,
    message: 'Email is available.',
  };
}

/**
 * Create a new clinic for an existing user
 */
export async function createClinic(userId: string, clinicName: string): Promise<AuthResponse> {
  // Get the existing user
  const { data: user, error: userError } = await supabaseServer
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  if (user.user_role !== 'superadmin') {
    throw new Error('Only superadmins can create clinics');
  }

  // Create the new clinic
  const { data: clinic, error: clinicError } = await supabaseServer
    .from('clinics')
    .insert({
      name: clinicName,
    })
    .select()
    .single();

  if (clinicError || !clinic) {
    throw new Error(`Failed to create clinic: ${clinicError?.message}`);
  }

  // Add user to the new clinic using the helper function
  const { error: addClinicError } = await supabaseServer.rpc('add_user_to_clinic', {
    p_user_id: userId,
    p_clinic_id: clinic.clinic_id,
  });

  if (addClinicError) {
    // Rollback: delete the clinic
    await supabaseServer.from('clinics').delete().eq('clinic_id', clinic.clinic_id);
    throw new Error(`Failed to add user to clinic: ${addClinicError.message}`);
  }

  // Generate JWT token with the new clinic
  const token = generateToken({
    userId: user.user_id,
    clinicId: clinic.clinic_id,
    userRole: 'superadmin', // User is superadmin of their new clinic
  });

  return {
    token,
    user: {
      userId: user.user_id,
      username: user.username,
      password: '',
      email: user.email,
      clinicId: clinic.clinic_id,
      activeClinicId: clinic.clinic_id,
      userRole: 'superadmin',
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    },
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
}

/**
 * Delete a clinic (only if user is superadmin of that clinic)
 */
export async function deleteClinic(userId: string, clinicId: string): Promise<boolean> {
  // Check if user has access to this clinic
  const { data: user, error: userError } = await supabaseServer
    .from('users')
    .select('clinic_ids')
    .eq('user_id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  // Check if clinic exists in user's clinic_ids
  if (!user.clinic_ids || !user.clinic_ids.includes(clinicId)) {
    throw new Error('You do not have access to this clinic');
  }

  // Remove user from clinic
  const { error: removeError } = await supabaseServer.rpc('remove_user_from_clinic', {
    p_user_id: userId,
    p_clinic_id: clinicId,
  });

  if (removeError) {
    throw new Error(`Failed to remove user from clinic: ${removeError.message}`);
  }

  // Check if clinic has any other users
  const { data: clinic, error: clinicError } = await supabaseServer
    .from('clinics')
    .select('user_ids')
    .eq('clinic_id', clinicId)
    .single();

  if (clinicError) {
    throw new Error('Clinic not found');
  }

  // If clinic has no more users, delete it completely
  if (!clinic.user_ids || clinic.user_ids.length === 0) {
    const { error: deleteError } = await supabaseServer
      .from('clinics')
      .delete()
      .eq('clinic_id', clinicId);

    if (deleteError) {
      throw new Error(`Failed to delete clinic: ${deleteError.message}`);
    }
  }

  return true;
}

/**
 * Switch user's active clinic
 */
export async function switchClinic(userId: string, clinicId: string): Promise<AuthResponse> {
  // Get user
  const { data: user, error: userError } = await supabaseServer
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User not found');
  }

  // Check if user has access to this clinic
  if (!user.clinic_ids || !user.clinic_ids.includes(clinicId)) {
    throw new Error('You do not have access to this clinic');
  }

  // Switch active clinic using the helper function
  const { error: switchError } = await supabaseServer.rpc('switch_active_clinic', {
    p_user_id: userId,
    p_clinic_id: clinicId,
  });

  if (switchError) {
    throw new Error(`Failed to switch clinic: ${switchError.message}`);
  }

  // Get clinic
  const { data: clinic, error: clinicError } = await supabaseServer
    .from('clinics')
    .select('*')
    .eq('clinic_id', clinicId)
    .single();

  if (clinicError || !clinic) {
    throw new Error('Clinic not found');
  }

  // Get user's role in this specific clinic
  // For now, we'll use the role from the users table
  // In a more advanced system, you might have a user_clinic_roles junction table
  const userRole = user.clinic_id === clinicId ? user.user_role : 'admin';

  // Generate new JWT token with the new clinic
  const token = generateToken({
    userId: user.user_id,
    clinicId: clinic.clinic_id,
    userRole: userRole,
  });

  return {
    token,
    user: {
      userId: user.user_id,
      username: user.username,
      password: '',
      email: user.email,
      clinicId: clinic.clinic_id,
      activeClinicId: clinic.clinic_id,
      userRole: userRole,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    },
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
}

