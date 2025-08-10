import { NextResponse } from 'next/server';
import { logoutUser } from '@/lib/auth/auth';

export async function POST() {
  try {
    // تسجيل خروج المستخدم (حذف الكوكيز)
    await logoutUser();
    
    // إرجاع استجابة نجاح
    return NextResponse.json({
      message: 'تم تسجيل الخروج بنجاح'
    });
  } catch (error) {
    console.error('Error in logout API:', error);
    return NextResponse.json(
      { message: 'حدث خطأ أثناء معالجة طلبك' },
      { status: 500 }
    );
  }
}


