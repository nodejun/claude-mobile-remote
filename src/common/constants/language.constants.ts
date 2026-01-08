/**
 * 파일 확장자 → 언어 매핑
 * 코드 하이라이팅 및 언어 감지에 사용
 */
export const LANGUAGE_MAP: Record<string, string> = {
  // TypeScript
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',

  // JavaScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',

  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',

  // Data formats
  '.json': 'json',
  '.xml': 'xml',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',

  // Documentation
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.txt': 'plaintext',

  // Backend languages
  '.py': 'python',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',

  // C family
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.cs': 'csharp',

  // Shell
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'zsh',
  '.ps1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',

  // Database
  '.sql': 'sql',

  // Frontend frameworks
  '.vue': 'vue',
  '.svelte': 'svelte',

  // Config files
  '.env': 'dotenv',
  '.gitignore': 'gitignore',
  '.dockerignore': 'dockerignore',
  '.editorconfig': 'editorconfig',
} as const;

/**
 * 기본 언어 (매핑되지 않은 확장자용)
 */
export const DEFAULT_LANGUAGE = 'plaintext';
