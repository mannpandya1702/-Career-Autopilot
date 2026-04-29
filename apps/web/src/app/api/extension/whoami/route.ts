import { NextResponse } from 'next/server';
import { userFromBearer } from '@/lib/extension/auth';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<NextResponse> {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ user_id: user.id, email: user.email });
}
