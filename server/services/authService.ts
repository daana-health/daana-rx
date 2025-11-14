import { supabaseServer } from '../utils/supabase';
import { generateToken } from '../utils/auth';
import { User, Clinic, AuthResponse } from '../../src/types/index';

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
      clinicId: user.clinic_id,
      userRole: user.user_role,
    });

    return {
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        password: '', // Never return password
        email: user.email,
        clinicId: user.clinic_id,
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
  // Authenticate with Supabase Auth
  const { data: authData, error: authError } = await supabaseServer.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    throw new Error(`Sign in failed: ${authError?.message || 'Invalid credentials'}`);
  }

  const userId = authData.user.id;

  // Get user record
  const { data: user, error: userError } = await supabaseServer
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (userError || !user) {
    throw new Error('User record not found');
  }

  // Get clinic
  const { data: clinic, error: clinicError } = await supabaseServer
    .from('clinics')
    .select('*')
    .eq('clinic_id', user.clinic_id)
    .single();

  if (clinicError || !clinic) {
    throw new Error('Clinic not found');
  }

  // Generate JWT token
  const token = generateToken({
    userId: user.user_id,
    clinicId: user.clinic_id,
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
