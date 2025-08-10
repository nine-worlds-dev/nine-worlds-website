// src/lib/db/search.ts
import { getDB, Novel } from './connection';

export async function searchNovels(query: string, limit: number = 20): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    // تنظيف وإعداد مصطلح البحث
    const searchTerm = `%${query.trim().replace(/\s+/g, '%')}%`;
    
    // البحث في العناوين والملخصات
    const result = await db.prepare(
      `SELECT * FROM novels 
       WHERE (title LIKE ? OR summary LIKE ?) AND is_deleted = FALSE
       ORDER BY 
         CASE 
           WHEN title LIKE ? THEN 1  -- تطابق دقيق في البداية
           WHEN title LIKE ? THEN 2  -- تطابق في أي مكان في العنوان
           WHEN summary LIKE ? THEN 3  -- تطابق في الملخص
           ELSE 4
         END,
         views DESC
       LIMIT ?`
    )
    .bind(
      `${query}%`,  // تطابق دقيق في بداية العنوان
      searchTerm,   // تطابق في أي مكان في العنوان
      searchTerm,   // تطابق في الملخص
      searchTerm,   // تطابق في الملخص
      searchTerm,   // تطابق في الملخص
      limit
    )
    .all();
    
    return result.results as unknown as Novel[];
  } catch (error) {
    console.error('Error searching novels:', error);
    return [];
  }
}

export async function searchByCategory(categoryId: number, limit: number = 20): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT n.* FROM novels n
       JOIN novel_categories nc ON n.id = nc.novel_id
       WHERE nc.category_id = ? AND n.is_deleted = FALSE
       ORDER BY n.views DESC
       LIMIT ?`
    )
    .bind(categoryId, limit)
    .all();
    
    return result.results as unknown as Novel[];
  } catch (error) {
    console.error('Error searching by category:', error);
    return [];
  }
}

export async function searchByAuthor(authorName: string, limit: number = 20): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const searchTerm = `%${authorName.trim().replace(/\s+/g, '%')}%`;
    
    const result = await db.prepare(
      `SELECT n.* FROM novels n
       JOIN users u ON n.author_id = u.id
       WHERE (u.username LIKE ? OR u.display_name LIKE ?) AND n.is_deleted = FALSE
       ORDER BY n.views DESC
       LIMIT ?`
    )
    .bind(searchTerm, searchTerm, limit)
    .all();
    
    return result.results as unknown as Novel[];
  } catch (error) {
    console.error('Error searching by author:', error);
    return [];
  }
}

export async function getRelatedNovels(novelId: number, limit: number = 5): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    // الحصول على تصنيفات الرواية
    const categories = await db.prepare(
      `SELECT category_id FROM novel_categories WHERE novel_id = ?`
    )
    .bind(novelId)
    .all<{ category_id: number }>();
    
    if (categories.results.length === 0) {
      return [];
    }
    
    // إنشاء قائمة بمعرفات التصنيفات
    const categoryIds = categories.results.map(cat => cat.category_id);
    
    // البحث عن روايات في نفس التصنيفات
    const placeholders = categoryIds.map(() => '?').join(',');
    
    const result = await db.prepare(
      `SELECT n.*, COUNT(nc.category_id) as category_matches
       FROM novels n
       JOIN novel_categories nc ON n.id = nc.novel_id
       WHERE nc.category_id IN (${placeholders})
       AND n.id != ? AND n.is_deleted = FALSE
       GROUP BY n.id
       ORDER BY category_matches DESC, n.views DESC
       LIMIT ?`
    )
    .bind(...categoryIds, novelId, limit)
    .all();
    
    return result.results as unknown as (Novel & { category_matches: number })[];
  } catch (error) {
    console.error('Error getting related novels:', error);
    return [];
  }
}

export async function getFeaturedNovels(limit: number = 10): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT * FROM novels 
       WHERE is_featured = TRUE AND is_deleted = FALSE
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
    
    return result.results as unknown as Novel[];
  } catch (error) {
    console.error('Error getting featured novels:', error);
    return [];
  }
}

export async function getTopNovelsByViews(limit: number = 10): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT * FROM novels 
       WHERE is_deleted = FALSE
       ORDER BY views DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
    
    return result.results as unknown as Novel[];
  } catch (error) {
    console.error('Error getting top novels by views:', error);
    return [];
  }
}

export async function getTopNovelsByComments(limit: number = 10): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT n.* FROM novels n
       JOIN statistics s ON n.id = s.novel_id
       WHERE n.is_deleted = FALSE
       ORDER BY s.total_comments DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
    
    return result.results as unknown as Novel[];
  } catch (error) {
    console.error('Error getting top novels by comments:', error);
    return [];
  }
}

export async function getTopNovelsByReactions(limit: number = 10): Promise<Novel[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT n.* FROM novels n
       JOIN statistics s ON n.id = s.novel_id
       WHERE n.is_deleted = FALSE
       ORDER BY s.total_reactions DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
    
    return result.results as unknown as Novel[];
  } catch (error) {
    console.error('Error getting top novels by reactions:', error);
    return [];
  }
}

export interface TopAuthor {
  id: number;
  username: string;
  display_name?: string;
  profile_image?: string;
  novel_count: number;
  total_views: number;
}

export async function getTopAuthors(limit: number = 10): Promise<TopAuthor[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT u.id, u.username, u.display_name, u.profile_image, 
              COUNT(DISTINCT n.id) as novel_count, 
              SUM(n.views) as total_views
       FROM users u
       JOIN novels n ON u.id = n.author_id
       WHERE n.is_deleted = FALSE
       GROUP BY u.id
       ORDER BY total_views DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
    
    return result.results as unknown as TopAuthor[];
  } catch (error) {
    console.error("Error getting top authors:", error);
    return [];
  }
}

export interface TopTranslator {
  id: number;
  username: string;
  display_name?: string;
  profile_image?: string;
  novel_count: number;
  total_views: number;
}

export async function getTopTranslators(limit: number = 10): Promise<TopTranslator[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT u.id, u.username, u.display_name, u.profile_image, 
              COUNT(DISTINCT n.id) as novel_count, 
              SUM(n.views) as total_views
       FROM users u
       JOIN novels n ON u.id = n.translator_id
       WHERE n.is_deleted = FALSE
       GROUP BY u.id
       ORDER BY total_views DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
    
    return result.results as unknown as TopTranslator[];
  } catch (error) {
    console.error("Error getting top translators:", error);
    return [];
  }
}

export interface TopUser {
  id: number;
  username: string;
  display_name?: string;
  profile_image?: string;
  comment_count: number;
  reaction_count: number;
}

export async function getTopUsers(limit: number = 10): Promise<TopUser[]> {
  const db = await getDB();
  
  try {
    const result = await db.prepare(
      `SELECT u.id, u.username, u.display_name, u.profile_image, 
              COUNT(DISTINCT c.id) as comment_count,
              COUNT(DISTINCT r.id) as reaction_count
       FROM users u
       LEFT JOIN comments c ON u.id = c.user_id AND c.is_deleted = FALSE
       LEFT JOIN reactions r ON u.id = r.user_id
       GROUP BY u.id
       ORDER BY (COUNT(DISTINCT c.id) + COUNT(DISTINCT r.id)) DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
    
    return result.results as unknown as TopUser[];
  } catch (error) {
    console.error("Error getting top users:", error);
    return [];
  }
}
