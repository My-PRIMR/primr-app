import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.error('[client-error]', JSON.stringify(body))
  } catch {
    console.error('[client-error] failed to parse body')
  }
  return NextResponse.json({ ok: true })
}
