import { NextRequest, NextResponse } from 'next/server'

const MAX_CHARS = 20000

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const name = file.name.toLowerCase()
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let text = ''

    if (name.endsWith('.pdf')) {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      const data = await parser.getText()
      text = data.text
    } else if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else if (name.endsWith('.txt') || name.endsWith('.md')) {
      text = buffer.toString('utf-8')
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, TXT, or MD.' }, { status: 400 })
    }

    const trimmed = text.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'Could not extract any text from the file.' }, { status: 422 })
    }

    return NextResponse.json({ text: trimmed.slice(0, MAX_CHARS) })
  } catch (err) {
    console.error('[extract] error:', err)
    return NextResponse.json({ error: 'Failed to process file.' }, { status: 500 })
  }
}
