import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import { useRef, useEffect } from "react"
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  Undo, Redo,
} from "lucide-react"
import { cn } from "@/lib/utils"

function ToolbarBtn({ onMouseDown, active, disabled, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      disabled={disabled}
      title={title}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded text-muted-foreground transition-colors shrink-0",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        active && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
}

export function RichTextEditor({ content, onChange, placeholder, className, minHeight = 280 }) {
  const lastSet = useRef(content)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      lastSet.current = html
      onChange?.(html)
    },
    editorProps: {
      attributes: {
        class: "rich-editor-content outline-none px-4 py-3 text-sm",
        style: `min-height:${minHeight}px`,
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (lastSet.current === content) return
    lastSet.current = content
    editor.commands.setContent(content ?? "", false)
  }, [content, editor])

  const cmd = (fn) => (e) => {
    e.preventDefault()
    fn(editor.chain().focus())
  }

  return (
    <div className={cn("border border-input rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-ring", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1.5">
        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleBold().run())}
          active={editor?.isActive("bold")}
          disabled={!editor}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleItalic().run())}
          active={editor?.isActive("italic")}
          disabled={!editor}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleUnderline().run())}
          active={editor?.isActive("underline")}
          disabled={!editor}
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleStrike().run())}
          active={editor?.isActive("strike")}
          disabled={!editor}
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleHeading({ level: 1 }).run())}
          active={editor?.isActive("heading", { level: 1 })}
          disabled={!editor}
          title="Heading 1"
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleHeading({ level: 2 }).run())}
          active={editor?.isActive("heading", { level: 2 })}
          disabled={!editor}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleHeading({ level: 3 }).run())}
          active={editor?.isActive("heading", { level: 3 })}
          disabled={!editor}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleBulletList().run())}
          active={editor?.isActive("bulletList")}
          disabled={!editor}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleOrderedList().run())}
          active={editor?.isActive("orderedList")}
          disabled={!editor}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={cmd(c => c.toggleBlockquote().run())}
          active={editor?.isActive("blockquote")}
          disabled={!editor}
          title="Blockquote"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <Divider />

        <ToolbarBtn
          onMouseDown={cmd(c => c.undo().run())}
          disabled={!editor?.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={cmd(c => c.redo().run())}
          disabled={!editor?.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}
