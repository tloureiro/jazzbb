import { createLowlight } from 'lowlight';
import hljs from 'highlight.js/lib/core';
import type { LanguageFn } from 'highlight.js';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import python from 'highlight.js/lib/languages/python';
import yaml from 'highlight.js/lib/languages/yaml';

type LanguageRegistration = {
  name: string;
  aliases?: string[];
  syntax: LanguageFn;
};

const registrations: LanguageRegistration[] = [
  { name: 'javascript', aliases: ['js'], syntax: javascript },
  { name: 'typescript', aliases: ['ts', 'tsx'], syntax: typescript },
  { name: 'json', syntax: json },
  { name: 'markdown', aliases: ['md'], syntax: markdown },
  { name: 'html', aliases: ['xml'], syntax: xml },
  { name: 'css', syntax: css },
  { name: 'bash', aliases: ['sh', 'shell'], syntax: bash },
  { name: 'sql', syntax: sql },
  { name: 'python', aliases: ['py'], syntax: python },
  { name: 'yaml', aliases: ['yml'], syntax: yaml },
];

const lowlight = createLowlight();

registrations.forEach(({ name, aliases = [], syntax }) => {
  if (!hljs.getLanguage(name)) {
    hljs.registerLanguage(name, syntax);
  }
  const allNames = [name, ...aliases];
  allNames.forEach((alias) => {
    if (!lowlight.listLanguages().includes(alias)) {
      lowlight.register(alias, syntax);
    }
  });
});

const languageList = Array.from(new Set(registrations.flatMap(({ name, aliases = [] }) => [name, ...aliases])));

function hasLanguage(language: string | undefined): language is string {
  return Boolean(language && hljs.getLanguage(language));
}

export function highlightCode(
  code: string,
  language?: string,
): { html: string; detectedLanguage: string | null } {
  if (hasLanguage(language)) {
    return {
      html: hljs.highlight(code, { language, ignoreIllegals: true }).value,
      detectedLanguage: language,
    };
  }
  const autodetected = hljs.highlightAuto(code, languageList);
  return {
    html: autodetected.value,
    detectedLanguage: autodetected.language ?? null,
  };
}

export { lowlight };
