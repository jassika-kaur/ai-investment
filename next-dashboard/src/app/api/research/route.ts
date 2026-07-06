import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { company, treatAsTicker } = await req.json();
    if (!company) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001/api/research';
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, treatAsTicker }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Failed to fetch research data' }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in API Route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
