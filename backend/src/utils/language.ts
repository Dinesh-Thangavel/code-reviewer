export const detectLanguageFromFile = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    const fullPath = filename.toLowerCase();

    // TypeScript/JavaScript
    if (['ts', 'tsx', 'mts', 'cts'].includes(extension || '')) {
        return 'typescript';
    }
    if (['js', 'jsx', 'mjs', 'cjs'].includes(extension || '')) {
        return 'javascript';
    }

    // Python
    if (['py', 'pyw', 'pyi'].includes(extension || '')) {
        return 'python';
    }

    // Java/Kotlin
    if (extension === 'kt' || extension === 'kts') {
        return 'kotlin';
    }
    if (extension === 'java') {
        return 'java';
    }

    // Swift/Objective-C
    if (['swift'].includes(extension || '')) {
        return 'swift';
    }
    if (['m', 'mm', 'h'].includes(extension || '')) {
        return 'objective-c';
    }

    // Dart/Flutter
    if (extension === 'dart') {
        return 'dart';
    }

    // Go
    if (extension === 'go') {
        return 'go';
    }

    // Rust
    if (['rs', 'toml'].includes(extension || '')) {
        return 'rust';
    }

    // C/C++
    if (['c', 'h'].includes(extension || '')) {
        return 'c';
    }
    if (['cpp', 'cxx', 'cc', 'hpp', 'hxx'].includes(extension || '')) {
        return 'cpp';
    }

    // PHP
    if (['php', 'phtml'].includes(extension || '')) {
        return 'php';
    }

    // Ruby
    if (['rb', 'rake'].includes(extension || '')) {
        return 'ruby';
    }

    // C#
    if (['cs', 'csx'].includes(extension || '')) {
        return 'csharp';
    }

    // HTML/CSS
    if (['html', 'htm', 'xhtml'].includes(extension || '')) {
        return 'html';
    }
    if (['css', 'scss', 'sass', 'less'].includes(extension || '')) {
        return 'css';
    }

    // SQL
    if (['sql', 'mysql', 'pgsql'].includes(extension || '')) {
        return 'sql';
    }

    // Shell scripts
    if (['sh', 'bash', 'zsh', 'fish'].includes(extension || '') || fullPath.includes('dockerfile')) {
        return 'shell';
    }

    // YAML/JSON
    if (['yaml', 'yml'].includes(extension || '')) {
        return 'yaml';
    }
    if (extension === 'json') {
        return 'json';
    }

    // Markdown
    if (['md', 'markdown'].includes(extension || '')) {
        return 'markdown';
    }

    // Vue
    if (extension === 'vue') {
        return 'vue';
    }

    // Svelte
    if (extension === 'svelte') {
        return 'svelte';
    }

    // R
    if (['r', 'rmd'].includes(extension || '')) {
        return 'r';
    }

    // Scala
    if (['scala', 'sc'].includes(extension || '')) {
        return 'scala';
    }

    // Default fallback
    return 'source code';
};
