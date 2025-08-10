// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/auth/auth';

interface RegisterRequest {
  email?: string;
  username?: string;
  displayName?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email, username, displayName, password }: RegisterRequest = await request.json();

    // التحقق من البيانات المدخلة
    if (!email || !username || !password) {
      return NextResponse.json(
        { message: 'جميع الحقول المطلوبة يجب ملؤها' },
        { status: 400 }
      );
    }

    // التحقق من صحة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'البريد الإلكتروني غير صالح' },
        { status: 400 }
      );
    }

    // التحقق من طول كلمة المرور
    if (password.length < 8) {
      return NextResponse.json(
        { message: 'يجب أن تكون كلمة المرور 8 أحرف على الأقل' },
        { status: 400 }
      );
    }

    // إنشاء المستخدم
    const user = await createUser(email, username, password, displayName);

    if (!user) {
      return NextResponse.json(
        { message: 'فشل إنشاء الحساب. قد يكون البريد الإلكتروني أو اسم المستخدم مستخدماً بالفعل.' },
        { status: 400 }
      );
    }

    // إرجاع استجابة نجاح
    return NextResponse.json(
      { message: 'تم إنشاء الحساب بنجاح', userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in register API:', error);
    return NextResponse.json(
      { message: 'حدث خطأ أثناء معالجة طلبك' },
      { status: 500 }
    );
  }
}
