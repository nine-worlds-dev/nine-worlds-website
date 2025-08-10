// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createAuthToken, setAuthCookie } from '@/lib/auth/auth';

interface LoginRequest {
  emailOrUsername?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { emailOrUsername, password }: LoginRequest = await request.json();

    // التحقق من البيانات المدخلة
    if (!emailOrUsername || !password) {
      return NextResponse.json(
        { message: 'جميع الحقول المطلوبة يجب ملؤها' },
        { status: 400 }
      );
    }

    // مصادقة المستخدم
    const user = await authenticateUser(emailOrUsername, password);

    if (!user) {
      return NextResponse.json(
        { message: 'البريد الإلكتروني/اسم المستخدم أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    // التحقق من حالة الحساب
    if (!user.is_active) {
      return NextResponse.json(
        { message: 'هذا الحساب غير نشط' },
        { status: 403 }
      );
    }

    if (user.is_banned) {
      const banMessage = user.ban_expiry 
        ? `تم حظر هذا الحساب حتى ${new Date(user.ban_expiry).toLocaleDateString('ar')}` 
        : 'تم حظر هذا الحساب بشكل دائم';
      
      return NextResponse.json(
        { message: `${banMessage}. السبب: ${user.ban_reason || 'غير محدد'}` },
        { status: 403 }
      );
    }

    // إنشاء توكن المصادقة
    const token = await createAuthToken(user);
    
    // حفظ التوكن في الكوكيز
    await setAuthCookie(token);

    // إرجاع استجابة نجاح
    return NextResponse.json({
      message: 'تم تسجيل الدخول بنجاح',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        profileImage: user.profile_image
      }
    });
  } catch (error) {
    console.error('Error in login API:', error);
    return NextResponse.json(
      { message: 'حدث خطأ أثناء معالجة طلبك' },
      { status: 500 }
    );
  }
}
