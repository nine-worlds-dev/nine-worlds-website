// src/lib/db/novels.ts
import { getDB, Novel, Chapter, Category } from './connection';

export async function createNovel(
  title: string,
  summary: string,
  authorId: number,
  translatorId?: number,
  coverImage?: string,
  categoryIds?: number[]
): Promise<Novel | null> {
  const db = await getDB();
  
  try {
    // بدء المعاملة
    await db.prepare('BEGIN').run();
    
    // إنشاء الرواية
    const type = translatorId ? 'translated' : 'original';
    const novel = await db.prepare(
      `INSERT INTO novels (title, summary, author_id, translator_id, cover_image, type, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ongoing')
       RETURNING *`
    )
    .bind(title, summary, authorId, translatorId || null, coverImage || null, type)
    .first() as Novel;
    
    if (!novel) {
      await db.prepare('ROLLBACK').run();
      return null;
    }
    
    // إضافة التصنيفات إذا وجدت
    if (categoryIds && categoryIds.length > 0) {
      for (const categoryId of categoryIds) {
        await db.prepare(
          `INSERT INTO novel_categories (novel_id, category_id)
           VALUES (?, ?)`
        )
        .bind(novel.id, categoryId)
        .run();
      }
    }
    
    // إنشاء إحصائيات الرواية
    await db.prepare(
      `INSERT INTO statistics (novel_id, total_views, total_comments, total_reactions, total_chapters)
       VALUES (?, 0, 0, 0, 0)`
    )
    .bind(novel.id)
    .run();
    
    // إنهاء المعاملة
    await db.prepare('COMMIT').run();
    
    return novel;
  } catch (error) {
    // التراجع عن المعاملة في حالة حدوث خطأ
    await db.prepare('ROLLBACK').run();
    console.error('Error creating novel:', error);
    return null;
  }
}

export async function getNovelById(id: number): Promise<Novel | null> {
  const db = await getDB();
  
  try {
    const novel = await db.prepare(
      `SELECT * FROM novels WHERE id = ? AND is_deleted = FALSE`
    )
    .bind(id)
    .first() as Novel;
    
    return novel;
  } catch (error) {
    console.error('Error getting novel by ID:', error);
    return null;
  }
}

export async function getNovelCategories(novelId: number): Promise<Category[]> {
  const db = await getDB();
  
  try {
    const categories = await db.prepare(
      `SELECT c.* FROM categories c
       JOIN novel_categories nc ON c.id = nc.category_id
       WHERE nc.novel_id = ?`
    )
    .bind(novelId)
    .all<Category>();
    
    return categories.results;
  } catch (error) {
    console.error('Error getting novel categories:', error);
    return [];
  }
}

export async function updateNovel(
  id: number,
  title: string,
  summary: string,
  coverImage?: string,
  status?: 'ongoing' | 'completed' | 'hiatus',
  categoryIds?: number[]
): Promise<Novel | null> {
  const db = await getDB();
  
  try {
    // بدء المعاملة
    await db.prepare('BEGIN').run();
    
    // تحديث الرواية
    const novel = await db.prepare(
      `UPDATE novels
       SET title = ?, summary = ?, cover_image = COALESCE(?, cover_image), status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
       RETURNING *`
    )
    .bind(title, summary, coverImage || null, status || null, id)
    .first() as Novel;
    
    if (!novel) {
      await db.prepare('ROLLBACK').run();
      return null;
    }
    
    // تحديث التصنيفات إذا وجدت
    if (categoryIds && categoryIds.length > 0) {
      // حذف التصنيفات الحالية
      await db.prepare(
        `DELETE FROM novel_categories WHERE novel_id = ?`
      )
      .bind(id)
      .run();
      
      // إضافة التصنيفات الجديدة
      for (const categoryId of categoryIds) {
        await db.prepare(
          `INSERT INTO novel_categories (novel_id, category_id)
           VALUES (?, ?)`
        )
        .bind(id, categoryId)
        .run();
      }
    }
    
    // إنهاء المعاملة
    await db.prepare('COMMIT').run();
    
    return novel;
  } catch (error) {
    // التراجع عن المعاملة في حالة حدوث خطأ
    await db.prepare('ROLLBACK').run();
    console.error('Error updating novel:', error);
    return null;
  }
}

export async function deleteNovel(id: number): Promise<boolean> {
  const db = await getDB();
  
  try {
    // تحديث حالة الحذف بدلاً من الحذف الفعلي
    await db.prepare(
      `UPDATE novels SET is_deleted = TRUE WHERE id = ?`
    )
    .bind(id)
    .run();
    
    return true;
  } catch (error) {
    console.error('Error deleting novel:', error);
    return false;
  }
}

export async function createChapter(
  novelId: number,
  title: string,
  content: string,
  authorId: number,
  translatorId?: number
): Promise<Chapter | null> {
  const db = await getDB();
  
  try {
    // بدء المعاملة
    await db.prepare('BEGIN').run();
    
    // الحصول على رقم الفصل التالي
    const lastChapter = await db.prepare(
      `SELECT MAX(chapter_number) as last_number FROM chapters WHERE novel_id = ?`
    )
    .bind(novelId)
    .first() as { last_number: number };
    
    const chapterNumber = (lastChapter?.last_number || 0) + 1;
    
    // إنشاء الفصل
    const chapter = await db.prepare(
      `INSERT INTO chapters (novel_id, title, content, chapter_number, author_id, translator_id)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(novelId, title, content, chapterNumber, authorId, translatorId || null)
    .first() as Chapter;
    
    if (!chapter) {
      await db.prepare('ROLLBACK').run();
      return null;
    }
    
    // تحديث عدد الفصول في إحصائيات الرواية
    await db.prepare(
      `UPDATE statistics
       SET total_chapters = total_chapters + 1, updated_at = CURRENT_TIMESTAMP
       WHERE novel_id = ?`
    )
    .bind(novelId)
    .run();
    
    // تحديث تاريخ تحديث الرواية
    await db.prepare(
      `UPDATE novels
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(novelId)
    .run();
    
    // إنهاء المعاملة
    await db.prepare('COMMIT').run();
    
    return chapter;
  } catch (error) {
    // التراجع عن المعاملة في حالة حدوث خطأ
    await db.prepare('ROLLBACK').run();
    console.error('Error creating chapter:', error);
    return null;
  }
}

export async function getChapterById(id: number): Promise<Chapter | null> {
  const db = await getDB();
  
  try {
    const chapter = await db.prepare(
      `SELECT * FROM chapters WHERE id = ? AND is_deleted = FALSE`
    )
    .bind(id)
    .first() as Chapter;
    
    return chapter;
  } catch (error) {
    console.error('Error getting chapter by ID:', error);
    return null;
  }
}

export async function updateChapter(
  id: number,
  title: string,
  content: string
): Promise<Chapter | null> {
  const db = await getDB();
  
  try {
    const chapter = await db.prepare(
      `UPDATE chapters
       SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
       RETURNING *`
    )
    .bind(title, content, id)
    .first() as Chapter;
    
    return chapter;
  } catch (error) {
    console.error('Error updating chapter:', error);
    return null;
  }
}

export async function deleteChapter(id: number): Promise<boolean> {
  const db = await getDB();
  
  try {
    // بدء المعاملة
    await db.prepare('BEGIN').run();
    
    // الحصول على معرف الرواية
    const chapter = await db.prepare(
      `SELECT novel_id FROM chapters WHERE id = ?`
    )
    .bind(id)
    .first<{ novel_id: number }>();
    
    if (!chapter) {
      await db.prepare('ROLLBACK').run();
      return false;
    }
    
    // تحديث حالة الحذف بدلاً من الحذف الفعلي
    await db.prepare(
      `UPDATE chapters SET is_deleted = TRUE WHERE id = ?`
    )
    .bind(id)
    .run();
    
    // تحديث عدد الفصول في إحصائيات الرواية
    await db.prepare(
      `UPDATE statistics
       SET total_chapters = total_chapters - 1, updated_at = CURRENT_TIMESTAMP
       WHERE novel_id = ?`
    )
    .bind(chapter.novel_id)
    .run();
    
    // إنهاء المعاملة
    await db.prepare('COMMIT').run();
    
    return true;
  } catch (error) {
    // التراجع عن المعاملة في حالة حدوث خطأ
    await db.prepare('ROLLBACK').run();
    console.error('Error deleting chapter:', error);
    return false;
  }
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDB();
  
  try {
    const categories = await db.prepare(
      `SELECT * FROM categories ORDER BY name`
    )
    .all<Category>();
    
    return categories.results;
  } catch (error) {
    console.error('Error getting all categories:', error);
    return [];
  }
}

export async function getLatestNovels(limit: number = 10): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const novels = await db.prepare(
      `SELECT * FROM novels 
       WHERE is_deleted = FALSE
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<Novel>();
    
    return novels.results;
  } catch (error) {
    console.error('Error getting latest novels:', error);
    return [];
  }
}

export async function getPopularNovels(limit: number = 10): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const novels = await db.prepare(
      `SELECT n.* FROM novels n
       JOIN statistics s ON n.id = s.novel_id
       WHERE n.is_deleted = FALSE
       ORDER BY s.total_views DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<Novel>();
    
    return novels.results;
  } catch (error) {
    console.error('Error getting popular novels:', error);
    return [];
  }
}

export async function getNovelsByCategory(categoryId: number, limit: number = 10): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const novels = await db.prepare(
      `SELECT n.* FROM novels n
       JOIN novel_categories nc ON n.id = nc.novel_id
       WHERE nc.category_id = ? AND n.is_deleted = FALSE
       ORDER BY n.updated_at DESC
       LIMIT ?`
    )
    .bind(categoryId, limit)
    .all<Novel>();
    
    return novels.results;
  } catch (error) {
    console.error('Error getting novels by category:', error);
    return [];
  }
}

export async function getNovelsByAuthor(authorId: number): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const novels = await db.prepare(
      `SELECT * FROM novels 
       WHERE author_id = ? AND is_deleted = FALSE
       ORDER BY updated_at DESC`
    )
    .bind(authorId)
    .all<Novel>();
    
    return novels.results;
  } catch (error) {
    console.error('Error getting novels by author:', error);
    return [];
  }
}

export async function getNovelsByTranslator(translatorId: number): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const novels = await db.prepare(
      `SELECT * FROM novels 
       WHERE translator_id = ? AND is_deleted = FALSE
       ORDER BY updated_at DESC`
    )
    .bind(translatorId)
    .all<Novel>();
    
    return novels.results;
  } catch (error) {
    console.error('Error getting novels by translator:', error);
    return [];
  }
}

export async function searchNovels(query: string): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const searchTerm = `%${query}%`;
    const novels = await db.prepare(
      `SELECT * FROM novels 
       WHERE (title LIKE ? OR summary LIKE ?) AND is_deleted = FALSE
       ORDER BY updated_at DESC
       LIMIT 20`
    )
    .bind(searchTerm, searchTerm)
    .all<Novel>();
    
    return novels.results;
  } catch (error) {
    console.error('Error searching novels:', error);
    return [];
  }
}

export async function incrementNovelViews(novelId: number): Promise<void> {
  const db = await getDB();
  
  try {
    // بدء المعاملة
    await db.prepare('BEGIN').run();
    
    // زيادة عدد المشاهدات في جدول الروايات
    await db.prepare(
      `UPDATE novels
       SET views = views + 1
       WHERE id = ?`
    )
    .bind(novelId)
    .run();
    
    // زيادة عدد المشاهدات في جدول الإحصاءات
    await db.prepare(
      `UPDATE statistics
       SET total_views = total_views + 1, updated_at = CURRENT_TIMESTAMP
       WHERE novel_id = ?`
    )
    .bind(novelId)
    .run();
    
    // إنهاء المعاملة
    await db.prepare('COMMIT').run();
  } catch (error) {
    // التراجع عن المعاملة في حالة حدوث خطأ
    await db.prepare('ROLLBACK').run();
    console.error('Error incrementing novel views:', error);
  }
}

export async function incrementChapterViews(chapterId: number): Promise<void> {
  const db = await getDB();
  
  try {
    // بدء المعاملة
    await db.prepare('BEGIN').run();
    
    // الحصول على معرف الرواية
    const chapter = await db.prepare(
      `SELECT novel_id FROM chapters WHERE id = ?`
    )
    .bind(chapterId)
    .first<{ novel_id: number }>();
    
    if (!chapter) {
      await db.prepare('ROLLBACK').run();
      return;
    }
    
    // زيادة عدد المشاهدات في جدول الفصول
    await db.prepare(
      `UPDATE chapters
       SET views = views + 1
       WHERE id = ?`
    )
    .bind(chapterId)
    .run();
    
    // زيادة عدد المشاهدات في جدول الإحصاءات
    await db.prepare(
      `UPDATE statistics
       SET total_views = total_views + 1, updated_at = CURRENT_TIMESTAMP
       WHERE novel_id = ?`
    )
    .bind(chapter.novel_id)
    .run();
    
    // إنهاء المعاملة
    await db.prepare('COMMIT').run();
  } catch (error) {
    // التراجع عن المعاملة في حالة حدوث خطأ
    await db.prepare('ROLLBACK').run();
    console.error('Error incrementing chapter views:', error);
  }
}

export async function getChaptersByNovelId(novelId: number): Promise<Chapter[]> {
  const db = await getDB();
  
  try {
    const chapters = await db.prepare(
      `SELECT * FROM chapters 
       WHERE novel_id = ? AND is_deleted = FALSE
       ORDER BY chapter_number ASC`
    )
    .bind(novelId)
    .all<Chapter>();
    
    return chapters.results;
  } catch (error) {
    console.error('Error getting chapters by novel ID:', error);
    return [];
  }
}

export async function canUserEditNovel(userId: number, novelId: number): Promise<boolean> {
  const db = await getDB();
  
  try {
    // التحقق من دور المستخدم
    const role = await db.prepare(
      `SELECT r.name FROM user_roles r
       JOIN users u ON u.role_id = r.id
       WHERE u.id = ?`
    )
    .bind(userId)
    .first<{ name: string }>();
    
    if (!role) return false;
    
    // المالك والمسؤول والمشرف يمكنهم تعديل أي رواية
    if (['owner', 'admin', 'moderator'].includes(role.name)) {
      return true;
    }
    
    // المؤلف والمترجم يمكنهم تعديل رواياتهم فقط
    const novel = await db.prepare(
      `SELECT * FROM novels WHERE id = ?`
    )
    .bind(novelId)
    .first() as Novel;
    
    if (!novel) return false;
    
    return novel.author_id === userId || novel.translator_id === userId;
  } catch (error) {
    console.error('Error checking if user can edit novel:', error);
    return false;
  }
}

export async function canUserEditChapter(userId: number, chapterId: number): Promise<boolean> {
  const db = await getDB();
  
  try {
    // التحقق من دور المستخدم
    const role = await db.prepare(
      `SELECT r.name FROM user_roles r
       JOIN users u ON u.role_id = r.id
       WHERE u.id = ?`
    )
    .bind(userId)
    .first<{ name: string }>();
    
    if (!role) return false;
    
    // المالك والمسؤول والمشرف يمكنهم تعديل أي فصل
    if (['owner', 'admin', 'moderator'].includes(role.name)) {
      return true;
    }
    
    // المؤلف والمترجم يمكنهم تعديل فصولهم فقط
    const chapter = await db.prepare(
      `SELECT * FROM chapters WHERE id = ?`
    )
    .bind(chapterId)
    .first() as Chapter;
    
    if (!chapter) return false;
    
    return chapter.author_id === userId || chapter.translator_id === userId;
  } catch (error) {
    console.error('Error checking if user can edit chapter:', error);
    return false;
  }
}
