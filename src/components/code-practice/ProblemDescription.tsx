/**
 * ProblemDescription - Left panel showing problem details
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '../ui/badge';
import { ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import type { Problem } from '../../hooks/useCodePractice';

interface ProblemDescriptionProps {
  problem: Problem;
}

export function ProblemDescription({ problem }: ProblemDescriptionProps) {
  const [hintsExpanded, setHintsExpanded] = useState(false);

  return (
    <div className="p-6 space-y-6">
      {/* Title & Metadata */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {problem.topics.map((topic) => (
            <Badge key={topic} variant="secondary" className="text-xs">
              {topic}
            </Badge>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{problem.description}</ReactMarkdown>
      </div>

      {/* Examples */}
      {problem.examples && problem.examples.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Examples</h3>
          {problem.examples.map((example, index) => (
            <div key={index} className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Example {index + 1}</p>
              <div className="space-y-1 font-mono text-sm">
                <div>
                  <span className="text-muted-foreground">Input: </span>
                  <span>{formatExampleValue(example.input)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Output: </span>
                  <span>{formatExampleValue(example.output)}</span>
                </div>
              </div>
              {example.explanation && (
                <p className="text-sm text-muted-foreground mt-2">
                  <span className="font-medium">Explanation: </span>
                  {example.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Constraints */}
      {problem.constraints && problem.constraints.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Constraints</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {problem.constraints.map((constraint, index) => (
              <li key={index} className="font-mono text-xs">{constraint}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Hints (collapsible) */}
      {problem.hints && problem.hints.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setHintsExpanded(!hintsExpanded)}
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {hintsExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Lightbulb className="h-4 w-4" />
            Hints ({problem.hints.length})
          </button>
          
          {hintsExpanded && (
            <div className="space-y-2 pl-6">
              {problem.hints.map((hint, index) => (
                <div key={index} className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
                  <p className="text-sm">
                    <span className="font-medium text-yellow-500">Hint {index + 1}: </span>
                    {hint}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Function Signature */}
      {problem.functionSignature && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Function Signature</h3>
          <div className="rounded-lg bg-muted/50 p-4">
            <code className="text-sm font-mono">
              {formatFunctionSignature(problem.functionSignature)}
            </code>
          </div>
        </div>
      )}

      {/* Limits */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Time Limit: {problem.timeLimit || 2000}ms</span>
        <span>Memory Limit: {problem.memoryLimit || 256}MB</span>
      </div>
    </div>
  );
}

function formatExampleValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatFunctionSignature(sig: { name: string; params: Array<{ name: string; type: any }>; returnType: any }): string {
  const params = sig.params.map(p => `${typeToString(p.type)} ${p.name}`).join(', ');
  const returnType = typeToString(sig.returnType);
  return `${returnType} ${sig.name}(${params})`;
}

function typeToString(typeSpec: { type: string; elementType?: any }): string {
  switch (typeSpec.type) {
    case 'int': return 'int';
    case 'long': return 'long';
    case 'float': return 'float';
    case 'double': return 'double';
    case 'boolean': return 'boolean';
    case 'string': return 'String';
    case 'char': return 'char';
    case 'void': return 'void';
    case 'array':
      return typeSpec.elementType ? `${typeToString(typeSpec.elementType)}[]` : 'Object[]';
    case 'matrix':
      return typeSpec.elementType ? `${typeToString(typeSpec.elementType)}[][]` : 'Object[][]';
    case 'linkedList': return 'ListNode';
    case 'tree': return 'TreeNode';
    default: return 'Object';
  }
}
