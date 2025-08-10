import { NextResponse } from 'next/server';
import { getCurrentUser, getUserRole } from '@/lib/auth/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { message: 'غير مصرح به' },
        { status: 401 }
      );
    }

    const role = await getUserRole(user.id);
    
    // إرجاع معلومات المستخدم (بدون كلمة المرور)
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        profileImage: user.profile_image,
        role: role?.name
      }
    });
  } catch (error) {
    console.error('Error in me API:', error);
    return NextResponse.json(
      { message: 'حدث خطأ أثناء معالجة طلبك' },
      { status: 500 }
    );
  }
}


