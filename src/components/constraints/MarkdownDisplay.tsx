"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { FileText, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import React from "react";

interface MarkdownDisplayProps {
  markdown: string;
  filename?: string;
}

export function MarkdownDisplay({ markdown, filename }: MarkdownDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Simple markdown parser for basic formatting
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let currentParagraph: string[] = [];
    let listItems: string[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join('\n').trim();
        if (text) {
          elements.push(
            <p key={`p-${elements.length}`} className="mb-3 text-sm leading-relaxed text-foreground">
              {renderInlineMarkdown(text)}
            </p>
          );
        }
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="mb-4 ml-4 space-y-2 list-disc list-outside">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-sm leading-relaxed text-foreground">
                {renderInlineMarkdown(item.trim())}
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    const flushCodeBlock = () => {
      if (codeBlockContent.length > 0) {
        elements.push(
          <pre key={`code-${elements.length}`} className="mb-4 p-4 bg-muted rounded-lg overflow-x-auto border border-border">
            <code className="text-xs font-mono text-foreground whitespace-pre">
              {codeBlockContent.join('\n')}
            </code>
          </pre>
        );
        codeBlockContent = [];
        codeBlockLanguage = '';
      }
    };

    lines.forEach((line, index) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock();
          inCodeBlock = false;
        } else {
          flushParagraph();
          flushList();
          inCodeBlock = true;
          codeBlockLanguage = line.slice(3).trim();
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Headers
      if (line.startsWith('### ')) {
        flushParagraph();
        flushList();
        elements.push(
          <h3 key={`h3-${index}`} className="mt-6 mb-3 text-lg font-semibold text-foreground">
            {line.slice(4).trim()}
          </h3>
        );
        return;
      }

      if (line.startsWith('## ')) {
        flushParagraph();
        flushList();
        elements.push(
          <h2 key={`h2-${index}`} className="mt-6 mb-3 text-xl font-bold text-foreground">
            {line.slice(3).trim()}
          </h2>
        );
        return;
      }

      if (line.startsWith('# ')) {
        flushParagraph();
        flushList();
        elements.push(
          <h1 key={`h1-${index}`} className="mt-6 mb-3 text-2xl font-bold text-foreground">
            {line.slice(2).trim()}
          </h1>
        );
        return;
      }

      // Lists
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || /^\d+\.\s/.test(line.trim())) {
        flushParagraph();
        const item = line.replace(/^[\s-*\d.]+\s*/, '').trim();
        if (item) {
          listItems.push(item);
        }
        return;
      }

      // Empty line
      if (line.trim() === '') {
        flushParagraph();
        flushList();
        return;
      }

      // Regular paragraph
      currentParagraph.push(line);
    });

    flushParagraph();
    flushList();
    flushCodeBlock();

    return elements;
  };

  const renderInlineMarkdown = (text: string): (string | React.ReactElement)[] => {
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;

    // Bold text **text**
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match;
    const boldMatches: Array<{ start: number; end: number; text: string }> = [];

    while ((match = boldRegex.exec(text)) !== null) {
      boldMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[1],
      });
    }

    let currentIndex = 0;
    boldMatches.forEach((boldMatch) => {
      if (boldMatch.start > currentIndex) {
        parts.push(text.slice(currentIndex, boldMatch.start));
      }
      parts.push(
        <strong key={`bold-${currentIndex}`} className="font-semibold text-foreground">
          {boldMatch.text}
        </strong>
      );
      currentIndex = boldMatch.end;
    });

    if (currentIndex < text.length) {
      parts.push(text.slice(currentIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  const parsedContent = parseMarkdown(markdown);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Extracted Markdown
            {filename && (
              <span className="text-xs font-normal text-muted-foreground ml-2">
                ({filename})
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ScrollArea className="h-[600px] w-full">
          <div className="prose prose-sm max-w-none dark:prose-invert pr-4">
            {parsedContent.length > 0 ? (
              parsedContent
            ) : (
              <p className="text-sm text-muted-foreground">No content to display</p>
            )}
          </div>
          <ScrollBar />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
