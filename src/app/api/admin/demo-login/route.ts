import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Verify this is a demo account
    if (!email.endsWith('.test')) {
      return NextResponse.json(
        { error: 'Only demo accounts (.test) can use quick login' },
        { status: 403 }
      );
    }

    // Verify credentials (basic check)
    if (password !== 'Testing123!') {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Get user by email
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (error) {
      return NextResponse.json(
        { error: 'Demo account not found. Please run the seed script first.' },
        { status: 404 }
      );
    }

    // Create a custom token for this user
    const customToken = await adminAuth.createCustomToken(userRecord.uid);

    return NextResponse.json({ 
      customToken,
      uid: userRecord.uid 
    });
  } catch (error) {
    console.error('Demo login error:', error);
    return NextResponse.json(
      { error: 'Failed to generate demo login' },
      { status: 500 }
    );
  }
}

