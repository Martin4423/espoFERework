import { useEffect, useRef } from "react";
import * as ace from "ace-builds";
import "ace-builds/src-noconflict/ext-language_tools";
import "ace-builds/src-noconflict/mode-css";
import "ace-builds/src-noconflict/theme-chrome";

export default function CssCodeEditor({ value, onChange, disabled, label }: { value: string; onChange: (value: string) => void; disabled?: boolean; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ace.Ace.Editor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const editor = ace.edit(container);
    editorRef.current = editor;
    editor.session.setMode("ace/mode/css");
    editor.setTheme("ace/theme/chrome");
    editor.setOptions({
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 12,
      minLines: 8,
      maxLines: 32,
      showPrintMargin: false,
      highlightActiveLine: true,
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: true,
      wrap: true,
      useWorker: false,
    });
    editor.container.setAttribute("aria-label", `${label} CSS editor`);
    editor.container.setAttribute("aria-describedby", "template-css-editor-help");
    editor.setValue(value || "", -1);
    const handleChange = () => onChangeRef.current(editor.getValue());
    (editor.session as any).on("change", handleChange);
    const resizeObserver = new ResizeObserver(() => editor.resize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      (editor.session as any).off("change", handleChange);
      editor.destroy();
      editorRef.current = null;
      container.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) editor.setValue(value || "", -1);
  }, [value]);

  useEffect(() => {
    editorRef.current?.setReadOnly(Boolean(disabled));
  }, [disabled]);

  return <div className={`template-style-editor${disabled ? " is-disabled" : ""}`} ref={containerRef} />;
}
