import { transformHeroBlock } from './migrate-hero-to-hero-new'

describe('transformHeroBlock', () => {
  it('maps title, tagline→subtitle, cta; preserves id', () => {
    const input = {
      id: 'hero-1',
      type: 'hero' as const,
      props: {
        title: 'Upload a doc. Get a lesson.',
        tagline: 'Turn a document into an interactive lesson.',
        cta: 'Start',
      },
    }
    const out = transformHeroBlock(input)
    expect(out.id).toBe('hero-1')
    expect(out.type).toBe('hero-new')
    expect(out.props).toEqual({
      title: 'Upload a doc. Get a lesson.',
      subtitle: 'Turn a document into an interactive lesson.',
      cta: 'Start',
    })
  })

  it('extracts first clock-icon meta as meta.duration', () => {
    const input = {
      id: 'h',
      type: 'hero' as const,
      props: {
        title: 'T',
        meta: [
          { icon: 'clock', label: '12 min' },
          { icon: 'clock', label: '99 min' }, // ignored
          { icon: 'level', label: 'Beginner' }, // dropped
        ],
      },
    }
    const out = transformHeroBlock(input)
    expect((out.props as any).meta).toEqual({ duration: '12 min' })
  })

  it('extracts first tag-icon meta as meta.source', () => {
    const input = {
      id: 'h',
      type: 'hero' as const,
      props: {
        title: 'T',
        meta: [
          { icon: 'tag', label: 'playbook.pdf' },
          { icon: 'tag', label: 'ignored.pdf' },
        ],
      },
    }
    const out = transformHeroBlock(input)
    expect((out.props as any).meta).toEqual({ source: 'playbook.pdf' })
  })

  it('drops level icon and image entirely', () => {
    const input = {
      id: 'h',
      type: 'hero' as const,
      props: {
        title: 'T',
        image: { src: 'https://example.com/x.jpg' },
        meta: [{ icon: 'level', label: 'Intermediate' }],
      },
    }
    const out = transformHeroBlock(input)
    expect((out.props as any).image).toBeUndefined()
    expect((out.props as any).meta).toBeUndefined()
  })

  it('combines clock and tag into meta, drops level', () => {
    const input = {
      id: 'h',
      type: 'hero' as const,
      props: {
        title: 'T',
        meta: [
          { icon: 'clock', label: '5 min' },
          { icon: 'level', label: 'X' },
          { icon: 'tag', label: 'doc.pdf' },
        ],
      },
    }
    const out = transformHeroBlock(input)
    expect((out.props as any).meta).toEqual({ duration: '5 min', source: 'doc.pdf' })
  })

  it('leaves kicker undefined — migration preserves nothing to fill it', () => {
    const input = { id: 'h', type: 'hero' as const, props: { title: 'T' } }
    const out = transformHeroBlock(input)
    expect((out.props as any).kicker).toBeUndefined()
  })
})
