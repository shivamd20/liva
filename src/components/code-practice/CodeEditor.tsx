/**
 * CodeEditor - Monaco editor wrapper with Java support
 */

import { useCallback, useRef } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import type { editor } from 'monaco-editor';

interface CodeEditorProps {
  code: string;
  language: 'java' | 'javascript' | 'typescript' | 'python';
  onChange: (code: string) => void;
  onRun?: () => void;
  readOnly?: boolean;
}

// Language mapping for Monaco
const monacoLanguageMap: Record<string, string> = {
  java: 'java',
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
};

export function CodeEditor({ code, language, onChange, onRun, readOnly = false }: CodeEditorProps) {
  const { theme } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Add keyboard shortcut for Run (Ctrl+Enter or Cmd+Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRun?.();
    });

    // Focus the editor
    editor.focus();
  }, [onRun]);

  const handleChange: OnChange = useCallback((value) => {
    onChange(value || '');
  }, [onChange]);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={monacoLanguageMap[language] || 'plaintext'}
        value={code}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          wordWrap: 'off',
          folding: true,
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          readOnly,
          padding: { top: 16, bottom: 16 },
          // Java-specific settings
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
        loading={
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
