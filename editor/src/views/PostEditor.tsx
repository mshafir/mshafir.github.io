import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extensions'
import { NodeSelection } from '@tiptap/pm/state'
import type { PostDocument, PostMeta } from '../shared/api'
import { ASSET_ORIGIN, htmlToMarkdown, markdownToHtml, readingMinutes, slugify, wordCount } from '../lib/markdown'
import { clockTime, today } from '../lib/format'
import {
  BackIcon,
  BulletIcon,
  CodeBlockIcon,
  DividerIcon,
  EyeIcon,
  ImageIcon,
  LinkIcon,
  NumberIcon,
  QuoteIcon,
  TrashIcon,
} from '../icons'

const SAVE_DELAY = 600
const UNTITLED_SLUG = /^untitled(-\d+)?$/

interface Props {
  slug: string
  onBack: () => void
  onRenamed: (slug: string) => void
  onSaved: () => void
}

export function PostEditor({ slug: initialSlug, onBack, onRenamed, onSaved }: Props) {
  const [post, setPost] = useState<PostDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.site.readPost(initialSlug).then(setPost, (e: Error) => setError(e.message))
  }, [initialSlug])

  if (error) {
    return (
      <div className="page">
        <button type="button" className="btn btn-quiet" onClick={onBack}>
          <BackIcon /> Posts
        </button>
        <p className="error">Could not open this post: {error}</p>
      </div>
    )
  }
  if (!post) return <div className="page dim">Opening…</div>
  return <LoadedEditor initial={post} onBack={onBack} onRenamed={onRenamed} onSaved={onSaved} />
}

function LoadedEditor({
  initial,
  onBack,
  onRenamed,
  onSaved,
}: { initial: PostDocument } & Omit<Props, 'slug'>) {
  const [meta, setMeta] = useState<PostMeta>(initial.meta)
  const [slug, setSlug] = useState(initial.slug)
  const [slugDraft, setSlugDraft] = useState(initial.slug)
  const [body, setBody] = useState(initial.body)
  const [mode, setMode] = useState<'visual' | 'markdown'>('visual')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  // The latest document, read by the debounced save and by handlers created once (drop/paste).
  const latest = useRef<PostDocument>({ ...initial })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Saves and renames touch the same file, so they run one at a time, in order.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task)
    queue.current = run.catch(() => undefined)
    return run
  }, [])

  // Only call from inside a queued task.
  const writeNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    try {
      await window.site.savePost(latest.current)
      setSavedAt(Date.now())
      setStatus(null)
      onSaved()
    } catch (e) {
      setStatus(`Not saved: ${(e as Error).message}`)
    }
  }, [onSaved])

  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    return enqueue(writeNow)
  }, [enqueue, writeNow])

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, SAVE_DELAY)
  }, [save])

  const flush = useCallback(async () => {
    if (timer.current) await save()
    else await queue.current
  }, [save])

  // Save anything pending when leaving the post.
  useEffect(() => () => void (timer.current && window.site.savePost(latest.current)), [])

  const updateMeta = (patch: Partial<PostMeta>) => {
    const next = { ...latest.current.meta, ...patch }
    latest.current = { ...latest.current, meta: next }
    setMeta(next)
    scheduleSave()
  }

  const updateBody = (markdown: string) => {
    setBody(markdown)
    latest.current = { ...latest.current, body: markdown }
    scheduleSave()
  }

  const editorRef = useRef<Editor | null>(null)

  /** Copy images into the repo, insert them, and select the last one so its alt text can be filled in. */
  const importImages = useCallback(async (files: File[], pos?: number) => {
    const editor = editorRef.current
    if (!editor) return
    for (const file of files) {
      const path = await window.site.importImage(latest.current.slug, file.name || 'pasted.png', await file.arrayBuffer())
      const image = { type: 'image', attrs: { src: `${ASSET_ORIGIN}${path}`, alt: '' } }
      if (pos === undefined) editor.chain().focus().insertContent(image).run()
      else editor.chain().focus().insertContentAt(pos, image).run()
      // The editor may move a block image to fit the document, so find where it actually landed.
      let at = -1
      editor.state.doc.descendants((node, nodePos) => {
        if (node.type.name === 'image' && node.attrs.src === image.attrs.src) at = nodePos
      })
      if (at >= 0) editor.commands.setNodeSelection(at)
      pos = undefined
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: markdownToHtml(initial.body),
    onUpdate: ({ editor }) => updateBody(htmlToMarkdown(editor.getHTML())),
    editorProps: {
      attributes: { class: 'prose', 'aria-label': 'Post body' },
      handleDrop(view, event, _slice, moved) {
        const files = imageFiles(event.dataTransfer)
        if (moved || !files.length) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        void importImages(files, pos)
        return true
      },
      handlePaste(view, event) {
        const files = imageFiles(event.clipboardData)
        if (!files.length) return false
        event.preventDefault()
        void importImages(files)
        return true
      },
    },
  })

  editorRef.current = editor

  // Ctrl/Cmd+S saves immediately (it already autosaves; this is for the habit).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  function renameTo(next: string, onlyIfUntitled = false) {
    return enqueue(async () => {
      const from = latest.current.slug
      // Checked when the task runs, not when it was asked for: an earlier rename may have won.
      if (next === from || (onlyIfUntitled && !UNTITLED_SLUG.test(from))) return
      try {
        if (timer.current) await writeNow()
        await window.site.renamePost(from, next)
        latest.current = { ...latest.current, slug: next }
        setSlug(next)
        setSlugDraft(next)
        onRenamed(next)
        setStatus(null)
      } catch (e) {
        setSlugDraft(latest.current.slug)
        setStatus((e as Error).message)
      }
    })
  }

  // A new post's file is named untitled.md until it gets a real title.
  function onTitleBlur() {
    const wanted = slugify(latest.current.meta.title)
    if (wanted && wanted !== 'untitled') void renameTo(wanted, true)
  }

  function setDraft(draft: boolean) {
    // Publishing a draft dates it today; you can still change the date afterwards.
    updateMeta(draft ? { draft } : { draft, date: meta.draft ? today() : meta.date })
  }

  function switchMode(next: 'visual' | 'markdown') {
    if (next === mode) return
    if (next === 'visual') editor?.commands.setContent(markdownToHtml(body), { emitUpdate: false })
    setMode(next)
  }

  async function preview() {
    await flush()
    await window.site.previewSite(`/writing/${slug}`)
  }

  async function goBack() {
    await flush()
    onBack()
  }

  const words = wordCount(body)

  return (
    <div className="editor-screen">
      <header className="editor-bar">
        <button type="button" className="btn btn-quiet" onClick={goBack}>
          <BackIcon /> Posts
        </button>
        <span className={`badge ${meta.draft ? 'badge-draft' : 'badge-published'}`}>{meta.draft ? 'Draft' : 'Published'}</span>
        <span className={status ? 'error small' : 'dim small'} role="status">
          {status ?? (savedAt ? `Saved to disk · ${clockTime(savedAt)}` : `content/posts/${slug}.md`)}
        </span>
        <span className="spacer" />
        <span className="mono dim small">
          {words.toLocaleString()} words · {readingMinutes(body)} min read
        </span>
        <button type="button" className="btn btn-ghost" onClick={preview}>
          <EyeIcon /> Preview
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setDraft(!meta.draft)}>
          {meta.draft ? 'Publish' : 'Unpublish'}
        </button>
      </header>

      <div className="editor-body">
        <div className="writing-area">
          {editor && <Toolbar editor={editor} mode={mode} onMode={switchMode} onImages={(files) => importImages(files)} />}
          {editor && mode === 'visual' && <ImageBar editor={editor} />}

          <article className="writing-column">
            <TitleInput
              value={meta.title}
              onChange={(title) => updateMeta({ title })}
              onBlur={onTitleBlur}
              onEnter={() => editor?.commands.focus('start')}
            />
            <div hidden={mode !== 'visual'}>
              <EditorContent editor={editor} />
            </div>
            {mode === 'markdown' && (
              <textarea
                className="markdown-source"
                aria-label="Markdown source"
                value={body}
                spellCheck
                onChange={(e) => updateBody(e.target.value)}
              />
            )}
          </article>
        </div>

        <aside className="settings" aria-label="Post settings">
          <div className="field">
            <span className="label-caps">Status</span>
            <div className="segmented" role="radiogroup" aria-label="Status">
              {[true, false].map((draft) => (
                <button key={String(draft)} type="button" role="radio" aria-checked={meta.draft === draft} onClick={() => setDraft(draft)}>
                  {draft ? 'Draft' : 'Published'}
                </button>
              ))}
            </div>
            {meta.draft && <p className="hint">Drafts stay out of the built site, even if you push them.</p>}
          </div>

          <label className="field">
            Post date
            <input type="date" value={meta.date} onChange={(e) => e.target.value && updateMeta({ date: e.target.value })} />
          </label>

          <label className="field">
            URL slug
            <span className="input-affix">
              <span>/writing/</span>
              <input
                value={slugDraft}
                onChange={(e) => setSlugDraft(slugify(e.target.value) || e.target.value.toLowerCase())}
                onBlur={() => (slugDraft && slugDraft !== slug ? renameTo(slugify(slugDraft)) : setSlugDraft(slug))}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            </span>
          </label>

          <label className="field">
            Description
            <textarea rows={3} value={meta.description} onChange={(e) => updateMeta({ description: e.target.value })} />
            <span className={`counter ${meta.description.length > 160 ? 'over' : ''}`}>{meta.description.length} / 160</span>
          </label>

          <TagInput tags={meta.tags} onChange={(tags) => updateMeta({ tags })} />

          {editor && <Outline editor={editor} />}

          <span className="spacer" />
          <DeleteButton
            onConfirm={async () => {
              if (timer.current) clearTimeout(timer.current)
              timer.current = null
              await queue.current
              await window.site.deletePost(latest.current.slug)
              onSaved()
              onBack()
            }}
          />
        </aside>
      </div>
    </div>
  )
}

function imageFiles(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []).filter((file) => file.type.startsWith('image/'))
}

function TitleInput({ value, onChange, onBlur, onEnter }: { value: string; onChange: (v: string) => void; onBlur: () => void; onEnter: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  const untitled = value === 'Untitled'
  return (
    <textarea
      ref={ref}
      className="title-input"
      rows={1}
      aria-label="Title"
      placeholder="Title"
      value={untitled ? '' : value}
      autoFocus={untitled}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, ' '))}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onEnter()
        }
      }}
    />
  )
}

// ── toolbar ──────────────────────────────────────────────────────────────

function Toolbar({
  editor,
  mode,
  onMode,
  onImages,
}: {
  editor: Editor
  mode: 'visual' | 'markdown'
  onMode: (mode: 'visual' | 'markdown') => void
  onImages: (files: File[]) => void
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      block: editor.isActive('heading', { level: 2 })
        ? 'h2'
        : editor.isActive('heading', { level: 3 })
          ? 'h3'
          : editor.isActive('heading', { level: 4 })
            ? 'h4'
            : 'p',
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      link: editor.isActive('link'),
      href: (editor.getAttributes('link').href as string | undefined) ?? '',
      bullet: editor.isActive('bulletList'),
      ordered: editor.isActive('orderedList'),
      quote: editor.isActive('blockquote'),
      codeBlock: editor.isActive('codeBlock'),
    }),
  })
  const [linkOpen, setLinkOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const visual = mode === 'visual'
  const chain = () => editor.chain().focus()

  function setBlock(value: string) {
    if (value === 'p') chain().setParagraph().run()
    else chain().setHeading({ level: Number(value[1]) as 2 | 3 | 4 }).run()
  }

  return (
    <div className="toolbar-wrap">
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        <select aria-label="Text style" value={state.block} disabled={!visual} onChange={(e) => setBlock(e.target.value)}>
          <option value="p">Paragraph</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
          <option value="h4">Small heading</option>
        </select>
        <span className="sep" />
        <ToolButton label="Bold (Ctrl+B)" active={state.bold} disabled={!visual} onClick={() => chain().toggleBold().run()}>
          <b>B</b>
        </ToolButton>
        <ToolButton label="Italic (Ctrl+I)" active={state.italic} disabled={!visual} onClick={() => chain().toggleItalic().run()}>
          <i className="serif">I</i>
        </ToolButton>
        <ToolButton label="Strikethrough" active={state.strike} disabled={!visual} onClick={() => chain().toggleStrike().run()}>
          <s>S</s>
        </ToolButton>
        <ToolButton label="Inline code" active={state.code} disabled={!visual} onClick={() => chain().toggleCode().run()}>
          <span className="mono small">&lt;/&gt;</span>
        </ToolButton>
        <ToolButton label="Link (Ctrl+K)" active={state.link || linkOpen} disabled={!visual} onClick={() => setLinkOpen((open) => !open)}>
          <LinkIcon />
        </ToolButton>
        <span className="sep" />
        <ToolButton label="Bulleted list" active={state.bullet} disabled={!visual} onClick={() => chain().toggleBulletList().run()}>
          <BulletIcon />
        </ToolButton>
        <ToolButton label="Numbered list" active={state.ordered} disabled={!visual} onClick={() => chain().toggleOrderedList().run()}>
          <NumberIcon />
        </ToolButton>
        <ToolButton label="Quote" active={state.quote} disabled={!visual} onClick={() => chain().toggleBlockquote().run()}>
          <QuoteIcon />
        </ToolButton>
        <ToolButton label="Code block" active={state.codeBlock} disabled={!visual} onClick={() => chain().toggleCodeBlock().run()}>
          <CodeBlockIcon />
        </ToolButton>
        <ToolButton label="Divider" disabled={!visual} onClick={() => chain().setHorizontalRule().run()}>
          <DividerIcon />
        </ToolButton>
        <span className="sep" />
        <button type="button" className="tool tool-accent" disabled={!visual} onClick={() => fileInput.current?.click()}>
          <ImageIcon /> Image
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) onImages(files)
          }}
        />
        <span className="sep" />
        <button
          type="button"
          className={`tool tool-mode ${visual ? '' : 'on'}`}
          aria-pressed={!visual}
          onClick={() => onMode(visual ? 'markdown' : 'visual')}
        >
          Markdown
        </button>
      </div>
      {linkOpen && visual && (
        <LinkEditor
          initial={state.href}
          onDone={(href) => {
            setLinkOpen(false)
            if (href === null) return
            if (href) chain().extendMarkRange('link').setLink({ href }).run()
            else chain().extendMarkRange('link').unsetLink().run()
          }}
        />
      )}
      <LinkShortcut editor={editor} onOpen={() => setLinkOpen(true)} />
    </div>
  )
}

function LinkShortcut({ editor, onOpen }: { editor: Editor; onOpen: () => void }) {
  useEffect(() => {
    const dom = editor.view.dom
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        onOpen()
      }
    }
    dom.addEventListener('keydown', onKey)
    return () => dom.removeEventListener('keydown', onKey)
  }, [editor, onOpen])
  return null
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" className={`tool ${active ? 'on' : ''}`} aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

/** Returns the new href, '' to remove the link, or null when cancelled. */
function LinkEditor({ initial, onDone }: { initial: string; onDone: (href: string | null) => void }) {
  const [href, setHref] = useState(initial)
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter') onDone(href.trim())
    if (e.key === 'Escape') onDone(null)
  }
  return (
    <div className="popover link-editor">
      <input autoFocus aria-label="Link address" placeholder="https://… or /writing/another-post" value={href} onChange={(e) => setHref(e.target.value)} onKeyDown={onKey} />
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onDone(href.trim())}>
        Apply
      </button>
      {initial && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDone('')}>
          Remove
        </button>
      )}
    </div>
  )
}

// ── selected image ───────────────────────────────────────────────────────

function ImageBar({ editor }: { editor: Editor }) {
  const image = useEditorState({
    editor,
    selector: ({ editor }) => {
      const selection = editor.state.selection
      if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') return null
      return { alt: (selection.node.attrs.alt as string) ?? '', src: selection.node.attrs.src as string }
    },
  })
  if (!image) return null
  return (
    <div className="image-bar" role="group" aria-label="Selected image">
      <span className="mono dim small">{image.src.replace(`${ASSET_ORIGIN}`, '')}</span>
      <label className="image-alt">
        Alt text
        <input
          key={image.src}
          defaultValue={image.alt}
          placeholder="Describe the image for screen readers"
          onChange={(e) => editor.chain().updateAttributes('image', { alt: e.target.value }).run()}
        />
      </label>
      {!image.alt && <span className="warn small">Needs alt text</span>}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => editor.chain().focus().deleteSelection().run()}>
        <TrashIcon /> Remove
      </button>
    </div>
  )
}

// ── side panel pieces ────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const tag = draft.trim().toLowerCase().replace(/\s+/g, '-')
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setDraft('')
  }
  return (
    <div className="field">
      <label htmlFor="tag-input">Tags</label>
      <div className="tags">
        {tags.map((tag) => (
          <button key={tag} type="button" className="tag" aria-label={`Remove tag ${tag}`} onClick={() => onChange(tags.filter((t) => t !== tag))}>
            {tag} <span aria-hidden="true">×</span>
          </button>
        ))}
        <input
          id="tag-input"
          placeholder="Add tag"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(',', ''))}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1))
            }
          }}
        />
      </div>
    </div>
  )
}

function Outline({ editor }: { editor: Editor }) {
  const headings = useEditorState({
    editor,
    selector: ({ editor }) => {
      const found: Array<{ level: number; text: string; pos: number }> = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') found.push({ level: node.attrs.level, text: node.textContent, pos })
        return node.type.name === 'doc'
      })
      return found
    },
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  })
  if (!headings.length) return null
  return (
    <nav className="field outline" aria-label="Outline">
      <span className="label-caps">Outline</span>
      {headings.map((h) => (
        <button
          key={`${h.pos}`}
          type="button"
          style={{ paddingLeft: (h.level - 2) * 12 }}
          className={h.level > 2 ? 'dim' : ''}
          onClick={() => editor.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run()}
        >
          {h.text || 'Untitled section'}
        </button>
      ))}
    </nav>
  )
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button type="button" className="btn btn-danger" onClick={() => (armed ? onConfirm() : setArmed(true))}>
      <TrashIcon /> {armed ? 'Click again to move to Trash' : 'Delete post'}
    </button>
  )
}
