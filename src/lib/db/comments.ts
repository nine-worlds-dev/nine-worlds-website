// src/lib/db/comments.ts
import { getDB, Comment } from './connection';

export async function createComment(
  userId: number,
  content: string,
  novelId?: number,
  chapterId?: number,
  parentCommentId?: number
): Promise<Comment | null> {
  const db = await getDB();
  
  try {
    // بدء المعاملة
    await db.prepare('BEGIN').run();
    
    // إنشاء التعليق
    const comment = await db.prepare(
      `INSERT INTO comments (user_id, novel_id, chapter_id, parent_comment_id, content)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(userId, novelId || null, chapterId || null, parentCommentId || null, content)
    .first() as Comment;
    
    if (!comment) {
      await db.prepare('ROLLBACK').run();
      return null;
    }
    
    // تحديث عدد التعليقات في إحصائيات الرواية
    if (novelId) {
      await db.prepare(
        `UPDATE statistics
         SET total_comments = total_comments + 1, updated_at = CURRENT_TIMESTAMP
         WHERE novel_id = ?`
      )
      .bind(novelId)
      .run();
    } else if (chapterId) {
      // الحصول على معرف الرواية من الفصل
      const chapter = await db.prepare(
        `SELECT novel_id FROM chapters WHERE id = ?`
      )
      .bind(chapterId)
      .first<{ novel_id: number }>();
      
      if (chapter) {
        await db.prepare(
          `UPDATE statistics
           SET total_comments = total_comments + 1, updated_at = CURRENT_TIMESTAMP
           WHERE novel_id = ?`
        )
        .bind(chapter.novel_id)
        .run();
      }
    }
    
    // إنهاء المعاملة
    await db.prepare('COMMIT').run();
    
    return comment;
  } catch (error) {
    // التراجع عن المعاملة في حالة حدوث خطأ
    await db.prepare('ROLLBACK').run();
    console.error('Error creating comment:', error);
    return null;
  }
}

export async function getCommentsByNovelId(novelId: number): Promise<Comment[]> {
  const db = await getDB();
  
  try {
    const comments = await db.prepare(
      `SELECT * FROM comments 
       WHERE novel_id = ? AND parent_comment_id IS NULL AND is_deleted = FALSE
       ORDER BY created_at DESC`
    )
    .bind(novelId)
    .all() as unknown as { results: Comment[] };
    
    return comments.results;
  } catch (error) {
    console.error('Error getting comments by novel ID:', error);
    return [];
  }
}

export async function getCommentsByChapterId(chapterId: number): Promise<Comment[]> {
  const db = await getDB();
  
  try {
    const comments = await db.prepare(
      `SELECT * FROM comments 
       WHERE chapter_id = ? AND parent_comment_id IS NULL AND is_deleted = FALSE
       ORDER BY created_at DESC`
    )
    .bind(chapterId)
    .all() as unknown as { results: Comment[] };
    
    return comments.results;
  } catch (error) {
    console.error('Error getting comments by chapter ID:', error);
    return [];
  }
}

export async function getCommentReplies(commentId: number): Promise<Comment[]> {
  const db = await getDB();
  
  try {
    const replies = await db.prepare(
      `SELECT * FROM comments 
       WHERE parent_comment_id = ? AND is_deleted = FALSE
       ORDER BY created_at ASC`
    )
    .bind(commentId)
    .all() as unknown as { results: Comment[] };
    
    return replies.results;
  } catch (error) {
    console.error('Error getting comment replies:', error);
    return [];
  }
}

export async function updateComment(id: number, content: string): Promise<Comment | null> {
  const db = await getDB();
  
  try {
    const comment = await db.prepare(
      `UPDATE comments
       SET content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
       RETURNING *`
    )
    .bind(content, id)
    .first() as Comment;
    
    return comment;
  } catch (error) {
    console.error('Error updating comment:', error);
    return null;
  }
}

export async function deleteComment(id: number): Promise<boolean> {
  const db = await getDB();
  
  try {
    // تحديث حالة الحذف بدلاً من الحذف الفعلي
    await db.prepare(
      `UPDATE comments SET is_deleted = TRUE WHERE id = ?`
    )
    .bind(id)
    .run();
    
    // تحديث حالة الحذف للردود على هذا التعليق
    await db.prepare(
      `UPDATE comments SET is_deleted = TRUE WHERE parent_comment_id = ?`
    )
    .bind(id)
    .run();
    
    return true;
  } catch (error) {
    console.error('Error deleting comment:', error);
    return false;
  }
}

export async function canUserEditComment(userId: number, commentId: number): Promise<boolean> {
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
    
    // المالك والمسؤول والمشرف يمكنهم تعديل أي تعليق
    if (['owner', 'admin', 'moderator'].includes(role.name)) {
      return true;
    }
    
    // المستخدم العادي يمكنه تعديل تعليقاته فقط
    const comment = await db.prepare(
      `SELECT * FROM comments WHERE id = ?`
    )
    .bind(commentId)
    .first() as Comment;
    
    if (!comment) return false;
    
    return comment.user_id === userId;
  } catch (error) {
    console.error('Error checking if user can edit comment:', error);
    return false;
  }
}

// نظام التفاعلات (الإعجابات)
export async function addReaction(
  userId: number,
  reactionType: string,
  novelId?: number,
  chapterId?: number,
  commentId?: number
): Promise<boolean> {
  const db = await getDB();
  
  try {
    // بدء المعاملة
    await db.prepare('BEGIN').run();
    
    // التحقق من وجود تفاعل سابق
    let existingReaction;
    if (novelId) {
      existingReaction = await db.prepare(
        `SELECT * FROM reactions 
         WHERE user_id = ? AND novel_id = ? AND reaction_type = ?`
      )
      .bind(userId, novelId, reactionType)
      .first();
    } else if (chapterId) {
      existingReaction = await db.prepare(
        `SELECT * FROM reactions 
         WHERE user_id = ? AND chapter_id = ? AND reaction_type = ?`
      )
      .bind(userId, chapterId, reactionType)
      .first();
    } else if (commentId) {
      existingReaction = await db.prepare(
        `SELECT * FROM reactions 
         WHERE user_id = ? AND comment_id = ? AND reaction_type = ?`
      )
      .bind(userId, commentId, reactionType)
      .first();
    }
    
    if (existingReaction) {
      // إذا كان التفاعل موجوداً بالفعل، نقوم بإلغائه
      if (novelId) {
        await db.prepare(
          `DELETE FROM reactions 
           WHERE user_id = ? AND novel_id = ? AND reaction_type = ?`
        )
        .bind(userId, novelId, reactionType)
        .run();
      } else if (chapterId) {
        await db.prepare(
          `DELETE FROM reactions 
           WHERE user_id = ? AND chapter_id = ? AND reaction_type = ?`
        )
        .bind(userId, chapterId, reactionType)
        .run();
      } else if (commentId) {
        await db.prepare(
          `DELETE FROM reactions 
           WHERE user_id = ? AND comment_id = ? AND reaction_type = ?`
        )
        .bind(userId, commentId, reactionType)
        .run();
      }
      
      // تحديث عدد التفاعلات في إحصائيات الرواية
      if (novelId) {
        await db.prepare(
          `UPDATE statistics
           SET total_reactions = total_reactions - 1, updated_at = CURRENT_TIMESTAMP
           WHERE novel_id = ?`
        )
        .bind(novelId)
        .run();
      } else if (chapterId) {
        // الحصول على معرف الرواية من الفصل
        const chapter = await db.prepare(
          `SELECT novel_id FROM chapters WHERE id = ?`
        )
        .bind(chapterId)
        .first() as { novel_id: number };
        
        if (chapter) {
          await db.prepare(
            `UPDATE statistics
             SET total_reactions = total_reactions - 1, updated_at = CURRENT_TIMESTAMP
             WHERE novel_id = ?`
          )
          .bind(chapter.novel_id)
          .run();
        }
      } else if (commentId) {
        // الحصول على معرف الرواية من التعليق
        const comment = await db.prepare(
          `SELECT novel_id, chapter_id FROM comments WHERE id = ?`
        )
        .bind(commentId)
        .first() as { novel_id?: number; chapter_id?: number };
        
        if (comment) {
          let novelId = comment.novel_id;
          
          if (!novelId && comment.chapter_id) {
            // الحصول على معرف الرواية من الفصل
            const chapter = await db.prepare(
              `SELECT novel_id FROM chapters WHERE id = ?`
            )
            .bind(comment.chapter_id)
            .first() as { novel_id: number };
            
            if (chapter) {
              novelId = chapter.novel_id;
            }
          }
          
          if (novelId) {
            await db.prepare(
              `UPDATE statistics
               SET total_reactions = total_reactions - 1, updated_at = CURRENT_TIMESTAMP
               WHERE novel_id = ?`
            )
            .bind(novelId)
            .run();
          }
        }
      }
      
      // إنهاء المعاملة
      await db.prepare('COMMIT').run();
      
      return true;
    }
    
    // إضافة تفاعل جديد
    if (novelId) {
      await db.prepare(
        `INSERT INTO reactions (user_id, novel_id, reaction_type)
         VALUES (?, ?, ?)`
      )
      .bind(userId, novelId, reactionType)
      .run();
      
      // تحديث عدد التفاعلات في إحصائيات الرواية
      await db.prepare(
        `UPDATE statistics
         SET total_reactions = total_reactions + 1, updated_at = CURRENT_TIMESTAMP
         WHERE novel_id = ?`
      )
      .bind(novelId)
      .run();
    } else if (chapterId) {
      await db.prepare(
        `INSERT INTO reactions (user_id, chapter_id, reaction_type)
         VALUES (?, ?, ?)`
      )
      .bind(userId, chapterId, reactionType)
      .run();
      
      // الحصول على معرف الرواية من الفصل
      const chapter = await db.prepare(
        `SELECT novel_id FROM chapters WHERE id = ?`
      )
      .bind(chapterId)
      .first<{ novel_id: number }>();
      
      if (chapter) {
        await db.prepare(
          `UPDATE statistics
           SET total_reactions = total_reactions + 1, updated_at = CURRENT_TIMESTAMP
           WHERE novel_id = ?`
        )
        .bind(chapter.novel_id)
        .run();
      }
    } else if (commentId) {
      await db.prepare(
        `INSERT INTO reactions (user_id, comment_id, reaction_type)
         VALUES (?, ?, ?)`
      )
      .bind(userId, commentId, reactionType)
      .run();
      
      // الحصول على معرف الرواية من التعليق
      const comment = await db.prepare(
        `SELECT novel_id, chapter_id FROM comments WHERE id = ?`
      )
      .bind(commentId)
      .first<{ novel_id?: number; chapter_id?: number }>();
      
      if (comment) {
        let novelId = comment.novel_id;
        
        if (!novelId && comment.chapter_id) {
          // الحصول على معرف الرواية من الفصل
          const chapter = await db.prepare(
            `SELECT novel_id FROM chapters WHERE id = ?`
          )
          .bind(comment.chapter_id)
          .first() as { novel_id: number };
          
          if (chapter) {
            novelId = chapter.novel_id;
          }
        }
        
        if (novelId) {
          await db.prepare(
            `UPDATE statistics
             SET total_reactions = total_reactions + 1, updated_at = CURRENT_TIMESTAMP
             WHERE novel_id = ?`
          )
          .bind(novelId)
          .run();
        }
      }
    }
    
    // إنهاء المعاملة
    await db.prepare('COMMIT').run();
    
    return true;
  } catch (error) {
    // التراجع عن المعاملة في حالة حدوث خطأ
    await db.prepare('ROLLBACK').run();
    console.error('Error adding reaction:', error);
    return false;
  }
}

export async function getReactionCount(
  reactionType: string,
  novelId?: number,
  chapterId?: number,
  commentId?: number
): Promise<number> {
  const db = await getDB();
  
  try {
    let count;
    if (novelId) {
      count = await db.prepare(
        `SELECT COUNT(*) as count FROM reactions 
         WHERE novel_id = ? AND reaction_type = ?`
      )
      .bind(novelId, reactionType)
      .first() as { count: number };
    } else if (chapterId) {
      count = await db.prepare(
        `SELECT COUNT(*) as count FROM reactions 
         WHERE chapter_id = ? AND reaction_type = ?`
      )
      .bind(chapterId, reactionType)
      .first() as { count: number };
    } else if (commentId) {
      count = await db.prepare(
        `SELECT COUNT(*) as count FROM reactions 
         WHERE comment_id = ? AND reaction_type = ?`
      )
      .bind(commentId, reactionType)
      .first() as { count: number };
    } else {
      return 0;
    }
    
    return count?.count || 0;
  } catch (error) {
    console.error('Error getting reaction count:', error);
    return 0;
  }
}

export async function hasUserReacted(
  userId: number,
  reactionType: string,
  novelId?: number,
  chapterId?: number,
  commentId?: number
): Promise<boolean> {
  const db = await getDB();
  
  try {
    let reaction;
    if (novelId) {
      reaction = await db.prepare(
        `SELECT * FROM reactions 
         WHERE user_id = ? AND novel_id = ? AND reaction_type = ?`
      )
      .bind(userId, novelId, reactionType)
      .first();
    } else if (chapterId) {
      reaction = await db.prepare(
        `SELECT * FROM reactions 
         WHERE user_id = ? AND chapter_id = ? AND reaction_type = ?`
      )
      .bind(userId, chapterId, reactionType)
      .first();
    } else if (commentId) {
      reaction = await db.prepare(
        `SELECT * FROM reactions 
         WHERE user_id = ? AND comment_id = ? AND reaction_type = ?`
      )
      .bind(userId, commentId, reactionType)
      .first();
    } else {
      return false;
    }
    
    return !!reaction;
  } catch (error) {
    console.error('Error checking if user has reacted:', error);
    return false;
  }
}
