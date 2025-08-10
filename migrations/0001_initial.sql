-- Migration number: 0001 	 2025-07-30
-- تهيئة قاعدة بيانات موقع "العوالم التسعة"

-- حذف الجداول إذا كانت موجودة مسبقاً
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS novels;
DROP TABLE IF EXISTS chapters;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS novel_categories;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS reactions;
DROP TABLE IF EXISTS bookmarks;
DROP TABLE IF EXISTS reading_history;
DROP TABLE IF EXISTS characters;
DROP TABLE IF EXISTS statistics;
DROP TABLE IF EXISTS notifications;

-- إنشاء جدول الأدوار
CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- إنشاء جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  role_id INTEGER NOT NULL,
  profile_image TEXT,
  cover_image TEXT,
  bio TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason TEXT,
  ban_expiry DATETIME,
  FOREIGN KEY (role_id) REFERENCES user_roles(id)
);

-- إنشاء جدول الروايات
CREATE TABLE IF NOT EXISTS novels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  cover_image TEXT,
  author_id INTEGER NOT NULL,
  translator_id INTEGER,
  status TEXT NOT NULL DEFAULT 'ongoing', -- ongoing, completed, hiatus
  type TEXT NOT NULL DEFAULT 'original', -- original, translated
  views INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (translator_id) REFERENCES users(id)
);

-- إنشاء جدول الفصول
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  translator_id INTEGER,
  views INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (novel_id) REFERENCES novels(id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (translator_id) REFERENCES users(id),
  UNIQUE(novel_id, chapter_number)
);

-- إنشاء جدول التصنيفات
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- إنشاء جدول العلاقة بين الروايات والتصنيفات
CREATE TABLE IF NOT EXISTS novel_categories (
  novel_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (novel_id, category_id),
  FOREIGN KEY (novel_id) REFERENCES novels(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- إنشاء جدول التعليقات
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  novel_id INTEGER,
  chapter_id INTEGER,
  parent_comment_id INTEGER,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (novel_id) REFERENCES novels(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id),
  FOREIGN KEY (parent_comment_id) REFERENCES comments(id),
  CHECK ((novel_id IS NOT NULL AND chapter_id IS NULL) OR (novel_id IS NULL AND chapter_id IS NOT NULL))
);

-- إنشاء جدول التفاعلات
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  novel_id INTEGER,
  chapter_id INTEGER,
  comment_id INTEGER,
  reaction_type TEXT NOT NULL, -- like, love, etc.
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (novel_id) REFERENCES novels(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id),
  FOREIGN KEY (comment_id) REFERENCES comments(id),
  CHECK (
    (novel_id IS NOT NULL AND chapter_id IS NULL AND comment_id IS NULL) OR
    (novel_id IS NULL AND chapter_id IS NOT NULL AND comment_id IS NULL) OR
    (novel_id IS NULL AND chapter_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE(user_id, novel_id, chapter_id, comment_id, reaction_type)
);

-- إنشاء جدول المكتبات الشخصية (المفضلة)
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  novel_id INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (novel_id) REFERENCES novels(id),
  UNIQUE(user_id, novel_id)
);

-- إنشاء جدول سجل القراءة
CREATE TABLE IF NOT EXISTS reading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  novel_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0, -- موضع القراءة في الفصل
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (novel_id) REFERENCES novels(id),
  FOREIGN KEY (chapter_id) REFERENCES chapters(id),
  UNIQUE(user_id, novel_id, chapter_id)
);

-- إنشاء جدول شخصيات الرواية
CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (novel_id) REFERENCES novels(id)
);

-- إنشاء جدول الإحصاءات
CREATE TABLE IF NOT EXISTS statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  novel_id INTEGER,
  total_views INTEGER NOT NULL DEFAULT 0,
  total_comments INTEGER NOT NULL DEFAULT 0,
  total_reactions INTEGER NOT NULL DEFAULT 0,
  total_chapters INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (novel_id) REFERENCES novels(id),
  CHECK ((user_id IS NOT NULL AND novel_id IS NULL) OR (user_id IS NULL AND novel_id IS NOT NULL))
);

-- إنشاء جدول الإشعارات
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  type TEXT NOT NULL, -- comment, reaction, system, etc.
  reference_id INTEGER, -- يشير إلى معرف العنصر المرتبط بالإشعار
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- إدخال بيانات أولية للأدوار
INSERT INTO user_roles (name, description) VALUES 
  ('reader', 'قارئ يمكنه القراءة والتعليق والتفاعل وإنشاء مكتبة شخصية'),
  ('translator', 'مترجم يمكنه نشر الروايات المترجمة وتعديلها'),
  ('author', 'مؤلف يمكنه نشر الروايات المؤلفة وتعديلها'),
  ('moderator', 'مشرف يمكنه إدارة المحتوى وحظر المستخدمين'),
  ('admin', 'مسؤول لديه صلاحيات إدارية متقدمة'),
  ('owner', 'مالك الموقع لديه جميع الصلاحيات');

-- إدخال بيانات أولية للتصنيفات
INSERT INTO categories (name, description) VALUES 
  ('أكشن', 'روايات تحتوي على مشاهد قتالية وأحداث مثيرة'),
  ('عسكري', 'روايات تدور أحداثها في بيئة عسكرية'),
  ('استراتيجي', 'روايات تركز على التخطيط الاستراتيجي والمعارك الذهنية'),
  ('تناسخ', 'روايات تتضمن انتقال الروح إلى جسد آخر بعد الموت'),
  ('تجسد', 'روايات يتجسد فيها البطل في عالم آخر'),
  ('فان أنمي', 'روايات مستوحاة من عالم الأنمي'),
  ('فان فيلم', 'روايات مستوحاة من أفلام'),
  ('فان مسلسل', 'روايات مستوحاة من مسلسلات'),
  ('فان رواية', 'روايات مستوحاة من روايات أخرى'),
  ('فان مانهوا', 'روايات مستوحاة من المانهوا الكورية'),
  ('فان مانها', 'روايات مستوحاة من المانها الصينية'),
  ('فان مانغا', 'روايات مستوحاة من المانغا اليابانية'),
  ('واقعي', 'روايات تحاكي الواقع'),
  ('خيال', 'روايات خيالية'),
  ('فانتازيا', 'روايات فانتازيا'),
  ('إيسيكاي', 'روايات ينتقل فيها البطل إلى عالم آخر'),
  ('مافيا', 'روايات تدور أحداثها في عالم المافيا والجريمة المنظمة'),
  ('قيادة', 'روايات تركز على القيادة وإدارة المجموعات'),
  ('دموي', 'روايات تحتوي على مشاهد عنيفة ودموية'),
  ('سياسي', 'روايات تتناول مواضيع سياسية'),
  ('بطل عبقري', 'روايات يكون فيها البطل ذكياً وعبقرياً'),
  ('بطل غبي', 'روايات يكون فيها البطل غبياً أو ساذجاً'),
  ('بطل مضاد', 'روايات يكون فيها البطل الرئيسي شخصية معقدة أو غامضة'),
  ('بطل شرير', 'روايات يكون فيها البطل شريراً'),
  ('بطل قوي', 'روايات يكون فيها البطل قوياً منذ البداية'),
  ('بطل ضعيف', 'روايات يكون فيها البطل ضعيفاً'),
  ('من ضعيف إلى قوي', 'روايات يتطور فيها البطل من ضعيف إلى قوي'),
  ('من قوي إلى ضعيف', 'روايات يتحول فيها البطل من قوي إلى ضعيف'),
  ('من قوي إلى أقوى', 'روايات يزداد فيها البطل قوة باستمرار'),
  ('نظام', 'روايات تعتمد على نظام معين للتطور'),
  ('بطل', 'روايات البطل الرئيسي فيها ذكر'),
  ('بطلة', 'روايات البطل الرئيسي فيها أنثى'),
  ('ميكا', 'روايات تتضمن روبوتات وآلات قتالية'),
  ('حروب', 'روايات تدور أحداثها في بيئة حروب'),
  ('نفسي', 'روايات تركز على الجانب النفسي للشخصيات'),
  ('بطل غني', 'روايات يكون فيها البطل غنياً'),
  ('بطل فقير', 'روايات يكون فيها البطل فقيراً'),
  ('من غني إلى فقير', 'روايات يتحول فيها البطل من غني إلى فقير'),
  ('من فقير إلى غني', 'روايات يتحول فيها البطل من فقير إلى غني'),
  ('من غني إلى أغنى', 'روايات يزداد فيها ثراء البطل'),
  ('سيوف وسحر', 'روايات تجمع بين القتال بالسيوف والسحر'),
  ('فنون قتال', 'روايات تركز على فنون القتال'),
  ('مدرسي', 'روايات تدور أحداثها في بيئة مدرسية أو أكاديمية'),
  ('وحوش', 'روايات تتضمن وحوشاً وكائنات خرافية'),
  ('شياطين', 'روايات تتضمن شياطين'),
  ('إلف', 'روايات تتضمن كائنات الإلف'),
  ('سحر', 'روايات تتضمن عناصر سحرية'),
  ('موريم', 'روايات مستوحاة من عالم موريم');

-- إنشاء الفهارس لتحسين الأداء
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_novels_author_id ON novels(author_id);
CREATE INDEX idx_novels_translator_id ON novels(translator_id);
CREATE INDEX idx_novels_title ON novels(title);
CREATE INDEX idx_novels_created_at ON novels(created_at);
CREATE INDEX idx_novels_views ON novels(views);
CREATE INDEX idx_chapters_novel_id ON chapters(novel_id);
CREATE INDEX idx_chapters_author_id ON chapters(author_id);
CREATE INDEX idx_chapters_translator_id ON chapters(translator_id);
CREATE INDEX idx_chapters_views ON chapters(views);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_novel_id ON comments(novel_id);
CREATE INDEX idx_comments_chapter_id ON comments(chapter_id);
CREATE INDEX idx_reactions_user_id ON reactions(user_id);
CREATE INDEX idx_reactions_novel_id ON reactions(novel_id);
CREATE INDEX idx_reactions_chapter_id ON reactions(chapter_id);
CREATE INDEX idx_reactions_comment_id ON reactions(comment_id);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_reading_history_user_id ON reading_history(user_id);
CREATE INDEX idx_reading_history_novel_id ON reading_history(novel_id);
CREATE INDEX idx_statistics_user_id ON statistics(user_id);
CREATE INDEX idx_statistics_novel_id ON statistics(novel_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
