// src/lib/db/library.ts
import { getDB } from './connection';

export interface Bookmark {
  id: number;
  user_id: number;
  novel_id: number;
  created_at: string;
}

export interface ReadingHistory {
  id: number;
  user_id: number;
  novel_id: number;
  chapter_id: number;
  position: number;
  created_at: string;
  updated_at: string;
}

// المكتبة الشخصية (المفضلة)
export async function addToLibrary(userId: number, novelId: number): Promise<boolean> {
  const db = await getDB();
  
  try {
    // التحقق من وجود الرواية في المكتبة مسبقاً
    const existingBookmark = await db.prepare(
      `SELECT * FROM bookmarks WHERE user_id = ? AND novel_id = ?`
    )
    .bind(userId, novelId)
    .first() as Bookmark | undefined;
    
    if (existingBookmark) {
      return true; // الرواية موجودة بالفعل في المكتبة
    }
    
    // إضافة الرواية إلى المكتبة
    await db.prepare(
      `INSERT INTO bookmarks (user_id, novel_id)
       VALUES (?, ?)`
    )
    .bind(userId, novelId)
    .run();
    
    return true;
  } catch (error) {
    console.error('Error adding novel to library:', error);
    return false;
  }
}

export async function removeFromLibrary(userId: number, novelId: number): Promise<boolean> {
  const db = await getDB();
  
  try {
    // حذف الرواية من المكتبة
    await db.prepare(
      `DELETE FROM bookmarks WHERE user_id = ? AND novel_id = ?`
    )
    .bind(userId, novelId)
    .run();
    
    return true;
  } catch (error) {
    console.error('Error removing novel from library:', error);
    return false;
  }
}

export async function getUserLibrary(userId: number): Promise<Bookmark[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT b.id, b.created_at, n.id as novel_id, n.title, n.summary, n.cover_image, n.author_id, n.translator_id, n.status, n.type, n.views
       FROM bookmarks b
       JOIN novels n ON b.novel_id = n.id
       WHERE b.user_id = ? AND n.is_deleted = FALSE
       ORDER BY b.created_at DESC`
    )
    .bind(userId)
    .all();
    
    return result.results as unknown as Bookmark[];
  } catch (error) {
    console.error("Error getting user library:", error);
    return [];
  }
}

export async function isNovelInLibrary(userId: number, novelId: number): Promise<boolean> {
  const db = await getDB();
  
  try {
    const bookmark = await db.prepare(
      `SELECT * FROM bookmarks WHERE user_id = ? AND novel_id = ?`
    )
    .bind(userId, novelId)
    .first() as Bookmark | undefined;
    
    return !!bookmark;
  } catch (error) {
    console.error('Error checking if novel is in library:', error);
    return false;
  }
}

// سجل القراءة وعلامات القراءة
export async function saveReadingProgress(
  userId: number,
  novelId: number,
  chapterId: number,
  position: number = 0
): Promise<boolean> {
  const db = await getDB();
  
  try {
    // التحقق من وجود سجل قراءة مسبق
    const existingHistory = await db.prepare(
      `SELECT * FROM reading_history WHERE user_id = ? AND novel_id = ? AND chapter_id = ?`
    )
    .bind(userId, novelId, chapterId)
    .first() as Bookmark | undefined;
    
    if (existingHistory) {
      // تحديث سجل القراءة الموجود
      await db.prepare(
        `UPDATE reading_history
         SET position = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND novel_id = ? AND chapter_id = ?`
      )
      .bind(position, userId, novelId, chapterId)
      .run();
    } else {
      // إنشاء سجل قراءة جديد
      await db.prepare(
        `INSERT INTO reading_history (user_id, novel_id, chapter_id, position)
         VALUES (?, ?, ?, ?)`
      )
      .bind(userId, novelId, chapterId, position)
      .run();
    }
    
    return true;
  } catch (error) {
    console.error('Error saving reading progress:', error);
    return false;
  }
}

export async function getReadingProgress(
  userId: number,
  novelId: number,
  chapterId?: number
): Promise<ReadingHistory | null> {
  const db = await getDB();
  
  try {
    let history;
    
    if (chapterId) {
      // الحصول على سجل قراءة فصل محدد
      history = await db.prepare(
        `SELECT * FROM reading_history 
         WHERE user_id = ? AND novel_id = ? AND chapter_id = ?`
      )
      .bind(userId, novelId, chapterId)
      .first() as ReadingHistory;
    } else {
      // الحصول على آخر فصل تمت قراءته في الرواية
      history = await db.prepare(
        `SELECT * FROM reading_history 
         WHERE user_id = ? AND novel_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .bind(userId, novelId)
      .first() as ReadingHistory;
    }
    
    return history;
  } catch (error) {
    console.error('Error getting reading progress:', error);
    return null;
  }
}

export async function getUserReadingHistory(userId: number, limit: number = 10): Promise<ReadingHistory[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT rh.id, rh.updated_at, rh.chapter_id, rh.position,
              n.id as novel_id, n.title as novel_title, n.cover_image,
              c.title as chapter_title, c.chapter_number
       FROM reading_history rh
       JOIN novels n ON rh.novel_id = n.id
       JOIN chapters c ON rh.chapter_id = c.id
       WHERE rh.user_id = ? AND n.is_deleted = FALSE AND c.is_deleted = FALSE
       ORDER BY rh.updated_at DESC
       LIMIT ?`
    )
    .bind(userId, limit)
    .all();
    
    return result.results as unknown as ReadingHistory[];
  } catch (error) {
    console.error("Error getting user reading history:", error);
    return [];
  }
}

// إحصاءات المستخدم
export interface UserStatistics {
  novels: number;
  translated_novels: number;
  chapters: number;
  translated_chapters: number;
  comments: number;
  reactions: number;
  views: number;
  comments_received: number;
  reactions_received: number;
}

export async function getUserStatistics(userId: number): Promise<UserStatistics> {
  const db = await getDB();
  
  try {
    // الحصول على إحصاءات المستخدم من جدول الإحصاءات
    const userStats = await db.prepare(
      `SELECT * FROM statistics WHERE user_id = ?`
    )
    .bind(userId)
    .first() as UserStatistics | undefined;
    
    if (userStats) {
      return userStats;
    }
    
    // إذا لم تكن هناك إحصاءات، نقوم بحسابها
    const novelCount = await db.prepare(
      `SELECT COUNT(*) as count FROM novels WHERE author_id = ? AND is_deleted = FALSE`
    )
    .bind(userId)
    .first() as { count: number };
    
    const translatedCount = await db.prepare(
      `SELECT COUNT(*) as count FROM novels WHERE translator_id = ? AND is_deleted = FALSE`
    )
    .bind(userId)
    .first() as { count: number };
    
    const chapterCount = await db.prepare(
      `SELECT COUNT(*) as count FROM chapters WHERE author_id = ? AND is_deleted = FALSE`
    )
    .bind(userId)
    .first() as { count: number };
    
    const translatedChapterCount = await db.prepare(
      `SELECT COUNT(*) as count FROM chapters WHERE translator_id = ? AND is_deleted = FALSE`
    )
    .bind(userId)
    .first() as { count: number };
    
    const commentCount = await db.prepare(
      `SELECT COUNT(*) as count FROM comments WHERE user_id = ? AND is_deleted = FALSE`
    )
    .bind(userId)
    .first() as { count: number };
    
    const reactionCount = await db.prepare(
      `SELECT COUNT(*) as count FROM reactions WHERE user_id = ?`
    )
    .bind(userId)
    .first() as { count: number };
    
    // حساب عدد المشاهدات التي حصل عليها المستخدم
    const novelViews = await db.prepare(
      `SELECT SUM(views) as total FROM novels WHERE author_id = ? AND is_deleted = FALSE`
    )
    .bind(userId)
    .first<{ total: number }>();
    
    const translatedViews = await db.prepare(
      `SELECT SUM(views) as total FROM novels WHERE translator_id = ? AND is_deleted = FALSE`
    )
    .bind(userId)
    .first<{ total: number }>();
    
    const chapterViews = await db.prepare(
      `SELECT SUM(views) as total FROM chapters WHERE author_id = ? AND is_deleted = FALSE`
    )
    .bind(userId)
    .first<{ total: number }>();
    
    const translatedChapterViews = await db.prepare(
      `SELECT SUM(views) as total FROM chapters WHERE translator_id = ? AND is_deleted = FALSE`
    )
    .bind(userId)
    .first<{ total: number }>();
    
    // حساب عدد التعليقات التي حصل عليها المستخدم
    const commentsReceived = await db.prepare(
      `SELECT COUNT(*) as count FROM comments c
       JOIN novels n ON c.novel_id = n.id
       WHERE n.author_id = ? AND c.is_deleted = FALSE`
    )
    .bind(userId)
    .first() as { count: number };
    
    const translatedCommentsReceived = await db.prepare(
      `SELECT COUNT(*) as count FROM comments c
       JOIN novels n ON c.novel_id = n.id
       WHERE n.translator_id = ? AND c.is_deleted = FALSE`
    )
    .bind(userId)
    .first() as { count: number };
    
    // حساب عدد التفاعلات التي حصل عليها المستخدم
    const reactionsReceived = await db.prepare(
      `SELECT COUNT(*) as count FROM reactions r
       JOIN novels n ON r.novel_id = n.id
       WHERE n.author_id = ?`
    )
    .bind(userId)
    .first() as { count: number };
    
    const translatedReactionsReceived = await db.prepare(
      `SELECT COUNT(*) as count FROM reactions r
       JOIN novels n ON r.novel_id = n.id
       WHERE n.translator_id = ?`
    )
    .bind(userId)
    .first() as { count: number };
    
    return {
      novels: novelCount?.count || 0,
      translated_novels: translatedCount?.count || 0,
      chapters: chapterCount?.count || 0,
      translated_chapters: translatedChapterCount?.count || 0,
      comments: commentCount?.count || 0,
      reactions: reactionCount?.count || 0,
      views: (novelViews?.total || 0) + (translatedViews?.total || 0) + (chapterViews?.total || 0) + (translatedChapterViews?.total || 0),
      comments_received: (commentsReceived?.count || 0) + (translatedCommentsReceived?.count || 0),
      reactions_received: (reactionsReceived?.count || 0) + (translatedReactionsReceived?.count || 0)
    };
  } catch (error) {
    console.error('Error getting user statistics:', error);
    return {
      novels: 0,
      translated_novels: 0,
      chapters: 0,
      translated_chapters: 0,
      comments: 0,
      reactions: 0,
      views: 0,
      comments_received: 0,
      reactions_received: 0
    };
  }
}
