// lib/admin/user-management.ts
import { getDB, User } from '../db/connection';
import { sendEmailNotification } from '../registration/notifications';

export interface UserWithDetails extends User {
  role_name: string;
  role_description: string;
  total_novels?: number;
  total_chapters?: number;
  total_comments?: number;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  banned_users: number;
  pending_users: number;
  by_role: Record<string, number>;
}

// التحقق من أن المستخدم هو المالك
async function verifyOwnerAccess(userId: number): Promise<boolean> {
  const db = await getDB();
  
  try {
    const user = await db.prepare(`
      SELECT role_id FROM users WHERE id = ?
    `).bind(userId).first() as any;
    
    return user && user.role_id === 6; // دور المالك
  } catch (error) {
    console.error('خطأ في التحقق من صلاحيات المالك:', error);
    return false;
  }
}

// الحصول على جميع المستخدمين (للمالك فقط)
export async function getAllUsers(ownerId: number, page = 1, limit = 50): Promise<{
  users: UserWithDetails[];
  total: number;
  pages: number;
} | null> {
  if (!await verifyOwnerAccess(ownerId)) {
    throw new Error('غير مصرح لك بالوصول لهذه المعلومات');
  }

  const db = await getDB();
  const offset = (page - 1) * limit;
  
  try {
    // الحصول على العدد الإجمالي
    const totalResult = await db.prepare(`
      SELECT COUNT(*) as total FROM users
    `).first() as any;
    
    const total = totalResult.total;
    const pages = Math.ceil(total / limit);

    // الحصول على المستخدمين مع تفاصيل الأدوار
    const users = await db.prepare(`
      SELECT 
        u.*,
        ur.name as role_name,
        ur.description as role_description,
        (SELECT COUNT(*) FROM novels WHERE author_id = u.id OR translator_id = u.id) as total_novels,
        (SELECT COUNT(*) FROM chapters WHERE author_id = u.id OR translator_id = u.id) as total_chapters,
        (SELECT COUNT(*) FROM comments WHERE user_id = u.id) as total_comments
      FROM users u
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all() as UserWithDetails[];

    return { users, total, pages };
  } catch (error) {
    console.error('خطأ في جلب المستخدمين:', error);
    return null;
  }
}

// الحصول على تفاصيل مستخدم محدد (للمالك فقط)
export async function getUserDetails(ownerId: number, targetUserId: number): Promise<UserWithDetails | null> {
  if (!await verifyOwnerAccess(ownerId)) {
    throw new Error('غير مصرح لك بالوصول لهذه المعلومات');
  }

  const db = await getDB();
  
  try {
    const user = await db.prepare(`
      SELECT 
        u.*,
        ur.name as role_name,
        ur.description as role_description,
        (SELECT COUNT(*) FROM novels WHERE author_id = u.id OR translator_id = u.id) as total_novels,
        (SELECT COUNT(*) FROM chapters WHERE author_id = u.id OR translator_id = u.id) as total_chapters,
        (SELECT COUNT(*) FROM comments WHERE user_id = u.id) as total_comments,
        approver.username as approved_by_username
      FROM users u
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      LEFT JOIN users approver ON u.approved_by = approver.id
      WHERE u.id = ?
    `).bind(targetUserId).first() as UserWithDetails;

    return user;
  } catch (error) {
    console.error('خطأ في جلب تفاصيل المستخدم:', error);
    return null;
  }
}

// الحصول على إحصائيات المستخدمين (للمالك فقط)
export async function getUserStats(ownerId: number): Promise<UserStats | null> {
  if (!await verifyOwnerAccess(ownerId)) {
    throw new Error('غير مصرح لك بالوصول لهذه المعلومات');
  }

  const db = await getDB();
  
  try {
    // الإحصائيات العامة
    const generalStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_users,
        COUNT(CASE WHEN is_banned = TRUE THEN 1 END) as banned_users,
        COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_users
      FROM users
    `).first() as any;

    // الإحصائيات حسب الدور
    const roleStats = await db.prepare(`
      SELECT ur.name, COUNT(u.id) as count
      FROM user_roles ur
      LEFT JOIN users u ON ur.id = u.role_id
      GROUP BY ur.id, ur.name
    `).all() as any[];

    const by_role: Record<string, number> = {};
    roleStats.forEach(stat => {
      by_role[stat.name] = stat.count;
    });

    return {
      total_users: generalStats.total_users,
      active_users: generalStats.active_users,
      banned_users: generalStats.banned_users,
      pending_users: generalStats.pending_users,
      by_role
    };
  } catch (error) {
    console.error('خطأ في جلب إحصائيات المستخدمين:', error);
    return null;
  }
}

// تغيير دور مستخدم (للمالك فقط)
export async function changeUserRole(
  ownerId: number, 
  targetUserId: number, 
  newRoleId: number, 
  reason?: string
): Promise<boolean> {
  if (!await verifyOwnerAccess(ownerId)) {
    throw new Error('غير مصرح لك بتنفيذ هذا الإجراء');
  }

  const db = await getDB();
  
  try {
    // الحصول على بيانات المستخدم والدور الجديد
    const user = await db.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(targetUserId).first() as User;

    const newRole = await db.prepare(`
      SELECT * FROM user_roles WHERE id = ?
    `).bind(newRoleId).first() as any;

    if (!user || !newRole) {
      throw new Error('المستخدم أو الدور غير موجود');
    }

    // منع تغيير دور المالك
    if (user.role_id === 6 && ownerId !== targetUserId) {
      throw new Error('لا يمكن تغيير دور المالك');
    }

    // تحديث دور المستخدم
    await db.prepare(`
      UPDATE users 
      SET role_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(newRoleId, targetUserId).run();

    // إرسال إشعار للمستخدم
    await sendEmailNotification({
      to: user.email,
      subject: 'تم تغيير دورك في العوالم التسعة',
      template: 'role_changed',
      data: {
        display_name: user.display_name,
        new_role: newRole.name,
        notes: reason || 'تم تغيير دورك من قبل إدارة الموقع'
      }
    });

    // تسجيل العملية في سجل الأنشطة
    await logAdminAction(ownerId, 'change_user_role', {
      target_user_id: targetUserId,
      old_role_id: user.role_id,
      new_role_id: newRoleId,
      reason
    });

    return true;
  } catch (error) {
    console.error('خطأ في تغيير دور المستخدم:', error);
    return false;
  }
}

// حظر مستخدم (للمالك فقط)
export async function banUser(
  ownerId: number, 
  targetUserId: number, 
  reason: string, 
  duration?: string
): Promise<boolean> {
  if (!await verifyOwnerAccess(ownerId)) {
    throw new Error('غير مصرح لك بتنفيذ هذا الإجراء');
  }

  const db = await getDB();
  
  try {
    const user = await db.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(targetUserId).first() as User;

    if (!user) {
      throw new Error('المستخدم غير موجود');
    }

    // منع حظر المالك
    if (user.role_id === 6) {
      throw new Error('لا يمكن حظر المالك');
    }

    // حساب تاريخ انتهاء الحظر
    let banExpiry = null;
    if (duration) {
      const now = new Date();
      if (duration.includes('day')) {
        const days = parseInt(duration);
        now.setDate(now.getDate() + days);
        banExpiry = now.toISOString();
      } else if (duration.includes('month')) {
        const months = parseInt(duration);
        now.setMonth(now.getMonth() + months);
        banExpiry = now.toISOString();
      }
    }

    // تحديث حالة المستخدم
    await db.prepare(`
      UPDATE users 
      SET is_banned = TRUE, ban_reason = ?, ban_expiry = ?, is_active = FALSE
      WHERE id = ?
    `).bind(reason, banExpiry, targetUserId).run();

    // إرسال إشعار للمستخدم
    await sendEmailNotification({
      to: user.email,
      subject: 'تم حظر حسابك في العوالم التسعة',
      template: 'account_banned',
      data: {
        display_name: user.display_name,
        ban_reason: reason,
        ban_duration: duration || 'دائم',
        contact_email: 'ghwjw01@gmail.com'
      }
    });

    // تسجيل العملية
    await logAdminAction(ownerId, 'ban_user', {
      target_user_id: targetUserId,
      reason,
      duration
    });

    return true;
  } catch (error) {
    console.error('خطأ في حظر المستخدم:', error);
    return false;
  }
}

// إلغاء حظر مستخدم (للمالك فقط)
export async function unbanUser(ownerId: number, targetUserId: number): Promise<boolean> {
  if (!await verifyOwnerAccess(ownerId)) {
    throw new Error('غير مصرح لك بتنفيذ هذا الإجراء');
  }

  const db = await getDB();
  
  try {
    const user = await db.prepare(`
      SELECT * FROM users WHERE id = ?
    `).bind(targetUserId).first() as User;

    if (!user) {
      throw new Error('المستخدم غير موجود');
    }

    // إلغاء الحظر
    await db.prepare(`
      UPDATE users 
      SET is_banned = FALSE, ban_reason = NULL, ban_expiry = NULL, is_active = TRUE
      WHERE id = ?
    `).bind(targetUserId).run();

    // إرسال إشعار للمستخدم
    await sendEmailNotification({
      to: user.email,
      subject: 'تم إلغاء حظر حسابك في العوالم التسعة',
      template: 'account_unbanned',
      data: {
        display_name: user.display_name,
        login_url: process.env.NEXT_PUBLIC_APP_URL + '/auth/login'
      }
    });

    // تسجيل العملية
    await logAdminAction(ownerId, 'unban_user', {
      target_user_id: targetUserId
    });

    return true;
  } catch (error) {
    console.error('خطأ في إلغاء حظر المستخدم:', error);
    return false;
  }
}

// تسجيل العمليات الإدارية
async function logAdminAction(adminId: number, action: string, details: Record<string, any>): Promise<void> {
  const db = await getDB();
  
  try {
    await db.prepare(`
      INSERT INTO admin_logs (admin_id, action, details, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(adminId, action, JSON.stringify(details)).run();
  } catch (error) {
    console.error('خطأ في تسجيل العملية الإدارية:', error);
  }
}

// البحث في المستخدمين (للمالك فقط)
export async function searchUsers(
  ownerId: number, 
  query: string, 
  filters?: {
    role_id?: number;
    is_active?: boolean;
    is_banned?: boolean;
  }
): Promise<UserWithDetails[]> {
  if (!await verifyOwnerAccess(ownerId)) {
    throw new Error('غير مصرح لك بالوصول لهذه المعلومات');
  }

  const db = await getDB();
  
  try {
    let sql = `
      SELECT 
        u.*,
        ur.name as role_name,
        ur.description as role_description
      FROM users u
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      WHERE (u.username LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)
    `;
    
    const params = [`%${query}%`, `%${query}%`, `%${query}%`];

    if (filters?.role_id) {
      sql += ` AND u.role_id = ?`;
      params.push(filters.role_id);
    }

    if (filters?.is_active !== undefined) {
      sql += ` AND u.is_active = ?`;
      params.push(filters.is_active);
    }

    if (filters?.is_banned !== undefined) {
      sql += ` AND u.is_banned = ?`;
      params.push(filters.is_banned);
    }

    sql += ` ORDER BY u.created_at DESC LIMIT 100`;

    const users = await db.prepare(sql).bind(...params).all() as UserWithDetails[];
    return users;
  } catch (error) {
    console.error('خطأ في البحث في المستخدمين:', error);
    return [];
  }
}

