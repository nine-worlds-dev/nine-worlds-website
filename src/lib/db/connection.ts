// lib/db/connection.ts

import type { D1Database } from '@cloudflare/workers-types';


export async function getDB(): Promise<D1Database> {
  if (process.env.NODE_ENV === 'production') {
    // In production, D1 binding is available via process.env.DB
    if (!process.env.DB) {
      throw new Error("D1 binding (process.env.DB) is not available.");
    }
    return process.env.DB as unknown as D1Database;
  } else {
    // In development, use wrangler to connect to local D1 or remote D1
    // This is a placeholder and might require more complex setup for local development
    // For local development, you might need to run `wrangler d1 execute DB --local --file your_query.sql`
    // or use a local D1 client library if available.
    console.warn('Using a placeholder for D1 in development. Ensure your local setup is correct.');
    // A more robust solution for local development would involve a local D1 client or mocking
    // For now, we'll return a mock object or throw an error if not in production
    return {} as D1Database; // Placeholder for development
  }
}

export interface User {
  id: number;
  email: string;
  username: string;
  display_name?: string;
  role_id: number;
  profile_image?: string;
  cover_image?: string;
  bio?: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
  is_banned: boolean;
  ban_reason?: string;
  ban_expiry?: string;
}

export interface Novel {
  id: number;
  title: string;
  summary?: string;
  cover_image?: string;
  author_id: number;
  translator_id?: number;
  status: 'ongoing' | 'completed' | 'hiatus';
  type: 'original' | 'translated';
  views: number;
  created_at: string;
  updated_at: string;
  is_featured: boolean;
  is_deleted: boolean;
}

export interface Chapter {
  id: number;
  novel_id: number;
  title: string;
  content: string;
  chapter_number: number;
  author_id: number;
  translator_id?: number;
  views: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface Comment {
  id: number;
  user_id: number;
  novel_id?: number;
  chapter_id?: number;
  parent_comment_id?: number;
  content: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface UserRole {
  id: number;
  name: string;
  description?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}



