// lib/auth/auth.ts
import { getDB, User, UserRole } from '../db/connection';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'default_secret_key_change_in_production');
const COOKIE_NAME = 'nine-worlds-auth';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

export async function createUser(
  email: string, 
  username: string, 
  password: string, 
  displayName?: string
): Promise<User | null> {
  const db = await getDB();
  const hashedPassword = await hashPassword(password);
  
  try {
    // القارئ هو الدور الافتراضي (role_id = 1)
    const result = await db.prepare(
      `INSERT INTO users (email, username, password_hash, display_name, role_id) 
       VALUES (?, ?, ?, ?, 1) 
       RETURNING *`
    )
    .bind(email, username, hashedPassword, displayName || username)
    .first() as User;
    
    return result;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

export async function authenticateUser(emailOrUsername: string, password: string): Promise<User | null> {
  const db = await getDB();
  
  try {
    const user = await db.prepare(
      `SELECT * FROM users WHERE email = ? OR username = ?`
    )
    .bind(emailOrUsername, emailOrUsername)
    .first() as User & { password_hash: string };
    
    if (!user) return null;
    
    const passwordMatch = await comparePasswords(password, user.password_hash);
    if (!passwordMatch) return null;
    
    // تحديث آخر تسجيل دخول
    await db.prepare(
      `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(user.id)
    .run();
    
    // حذف كلمة المرور المشفرة من الكائن قبل إرجاعه
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password_hash: _password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}

export async function getUserRole(userId: number): Promise<UserRole | null> {
  const db = await getDB();
  
  try {
    const role = await db.prepare(
      `SELECT r.* FROM user_roles r
       JOIN users u ON u.role_id = r.id
       WHERE u.id = ?`
    )
    .bind(userId)
    .first() as UserRole;
    
    return role;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

export async function createAuthToken(user: User): Promise<string> {
  const role = await getUserRole(user.id);
  
  const token = await new SignJWT({ 
    id: user.id,
    email: user.email,
    username: user.username,
    role: role?.name || 'reader'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // صلاحية لمدة 7 أيام
    .sign(JWT_SECRET);
  
  return token;
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 أيام
    sameSite: 'strict',
  });
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

export interface AuthTokenPayload {
  id: number;
  email: string;
  username: string;
  role: string;
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as unknown as AuthTokenPayload;
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const token = await getAuthToken();
  if (!token) return null;
  
  const payload = await verifyAuthToken(token);
  if (!payload) return null;
  
  const db = await getDB();
  
  try {
    const user = await db.prepare(
      `SELECT * FROM users WHERE id = ?`
    )
    .bind(payload.id)
    .first() as User;
    
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function hasPermission(userId: number, permission: string): Promise<boolean> {
  const role = await getUserRole(userId);
  if (!role) return false;
  
  // تنفيذ منطق الصلاحيات حسب نوع الدور
  switch (role.name) {
    case 'owner':
      return true; // المالك لديه جميع الصلاحيات
    case 'admin':
      return permission !== 'owner_only'; // المسؤول لديه جميع الصلاحيات ما عدا الخاصة بالمالك
    case 'moderator':
      return !['owner_only', 'admin_only'].includes(permission); // المشرف لديه صلاحيات محدودة
    case 'author':
    case 'translator':
      return ['read', 'comment', 'create_novel', 'edit_own_novel', 'delete_own_novel'].includes(permission);
    case 'reader':
      return ['read', 'comment'].includes(permission);
    default:
      return false;
  }
}
