"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

interface ReadOnlyEditorProps {
  content: object;
}

export default function ReadOnlyEditor({ content }: ReadOnlyEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Table, TableRow, TableCell, TableHeader],
    content,
    editable: false,
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div className="prose prose-sm max-w-none p-5 text-text-primary [&_.ProseMirror]:outline-none">
      <EditorContent editor={editor} />
    </div>
  );
}
