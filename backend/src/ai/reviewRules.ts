export const reviewRules: Record<string, string[]> = {
    'typescript': [
        'Analyze line-by-line for type safety: avoid `any`, use proper generics, check for undefined/null access.',
        'Check async/await patterns: ensure proper error handling, avoid mixing .then() with await, verify Promise.all() usage.',
        'React-specific: identify unnecessary re-renders, missing dependency arrays in hooks, improper key usage in lists.',
        'Security: detect exposed secrets, unsafe eval() usage, XSS vulnerabilities in string interpolation.',
        'Performance: check for unnecessary computations, missing memoization, large bundle sizes.',
        'Code quality: verify proper error boundaries, consistent naming conventions, DRY principle violations.'
    ],
    'javascript': [
        'Line-by-line analysis: check for undefined/null access, missing optional chaining, improper type coercion.',
        'Async handling: verify Promise chains, async/await usage, error propagation in async functions.',
        'Security: detect SQL injection risks, XSS vulnerabilities, exposed API keys, unsafe DOM manipulation.',
        'Performance: identify memory leaks, event listener cleanup, debouncing/throttling needs.',
        'Modern JS: check for proper use of const/let, arrow functions, destructuring, template literals.',
        'React/Vue: analyze component lifecycle, state management, prop validation.'
    ],
    'python': [
        'Type safety: check for missing type hints, improper type usage, None handling.',
        'Error handling: verify try/except blocks, proper exception types, error propagation.',
        'Performance: identify N+1 queries, inefficient list comprehensions, missing caching.',
        'Security: detect SQL injection, command injection, path traversal, unsafe deserialization.',
        'Code style: check PEP 8 compliance, proper docstrings, import organization.',
        'Best practices: verify context managers for file/resource handling, proper use of generators.'
    ],
    'java': [
        'Null safety: check for NullPointerException risks, proper Optional usage, null checks.',
        'Exception handling: verify proper exception types, no swallowed exceptions, resource cleanup in finally blocks.',
        'Threading: identify race conditions, deadlocks, improper synchronization, volatile usage.',
        'Memory: check for memory leaks, unclosed streams/resources, static references to contexts.',
        'Security: detect SQL injection, XSS, insecure random number generation, weak encryption.',
        'Code quality: verify proper encapsulation, SOLID principles, design patterns usage.'
    ],
    'kotlin': [
        'Null safety: analyze nullable types, safe calls (?.), Elvis operator (?:), let/run/apply scopes.',
        'Coroutines: check for proper suspend functions, cancellation handling, structured concurrency.',
        'Performance: identify unnecessary object creation, inefficient collection operations.',
        'Security: verify proper input validation, secure storage, encryption usage.',
        'Idioms: check for proper use of data classes, sealed classes, extension functions.',
        'Error handling: verify Result types, exception handling, proper error propagation.'
    ],
    'swift': [
        'Memory safety: check for force unwraps (!), optional binding, retain cycles in closures.',
        'Concurrency: verify proper async/await usage, actor isolation, main thread UI updates.',
        'Error handling: check for proper do-catch blocks, Result types, error propagation.',
        'Performance: identify unnecessary copies, inefficient array operations, memory leaks.',
        'Security: detect injection risks, insecure storage, weak encryption.',
        'Swift idioms: verify proper use of optionals, guard statements, protocol-oriented design.'
    ],
    'dart': [
        'Null safety: check for proper null-aware operators, late initialization, required parameters.',
        'Flutter-specific: analyze widget rebuild performance, const constructors, state management.',
        'Async: verify proper Future/Stream handling, async/await usage, error handling.',
        'Performance: identify unnecessary rebuilds, inefficient list operations, memory leaks.',
        'Security: check for exposed secrets, insecure storage, network security.',
        'Code quality: verify proper error handling, consistent naming, widget composition.'
    ],
    'go': [
        'Error handling: verify proper error return values, error wrapping, nil checks.',
        'Concurrency: check for race conditions, proper channel usage, goroutine leaks.',
        'Memory: identify memory leaks, improper pointer usage, slice capacity issues.',
        'Security: detect injection risks, insecure random generation, weak encryption.',
        'Idioms: verify proper use of interfaces, error handling patterns, package organization.',
        'Performance: check for inefficient string operations, unnecessary allocations.'
    ],
    'rust': [
        'Memory safety: verify proper ownership, borrowing rules, lifetime annotations.',
        'Error handling: check for proper Result/Option usage, error propagation, panic handling.',
        'Concurrency: identify data races, proper use of Arc/Mutex, async/await patterns.',
        'Performance: check for unnecessary clones, inefficient allocations, iterator usage.',
        'Security: detect unsafe block usage, buffer overflows, integer overflow.',
        'Idioms: verify proper use of match, Option/Result patterns, trait implementations.'
    ],
    'cpp': [
        'Memory management: check for memory leaks, double deletion, dangling pointers, RAII usage.',
        'Type safety: verify proper casting, template usage, const correctness.',
        'Concurrency: identify race conditions, proper mutex usage, thread safety.',
        'Performance: check for unnecessary copies, move semantics, efficient algorithms.',
        'Security: detect buffer overflows, integer overflow, unsafe casts.',
        'Modern C++: verify proper use of smart pointers, STL algorithms, lambda expressions.'
    ],
    'c': [
        'Memory safety: check for buffer overflows, memory leaks, dangling pointers, uninitialized variables.',
        'Security: detect format string vulnerabilities, integer overflow, unsafe functions.',
        'Error handling: verify proper return value checks, error codes, resource cleanup.',
        'Performance: identify inefficient algorithms, unnecessary memory operations.',
        'Code quality: check for proper function organization, consistent style, documentation.'
    ],
    'php': [
        'Security: detect SQL injection, XSS vulnerabilities, CSRF risks, exposed secrets.',
        'Type safety: check for proper type hints, null handling, strict types.',
        'Error handling: verify proper exception handling, error reporting, logging.',
        'Performance: identify N+1 queries, inefficient array operations, missing caching.',
        'Modern PHP: check for proper use of namespaces, autoloading, PSR standards.',
        'Code quality: verify proper validation, sanitization, dependency injection.'
    ],
    'ruby': [
        'Security: detect SQL injection, XSS, mass assignment vulnerabilities, exposed secrets.',
        'Performance: identify N+1 queries, inefficient database queries, missing caching.',
        'Error handling: verify proper exception handling, rescue blocks, error logging.',
        'Code quality: check for proper use of blocks, metaprogramming, Ruby idioms.',
        'Rails-specific: verify proper use of ActiveRecord, validations, callbacks, scopes.'
    ],
    'csharp': [
        'Null safety: check for NullReferenceException risks, nullable reference types, null checks.',
        'Async/await: verify proper async patterns, ConfigureAwait usage, cancellation tokens.',
        'Security: detect SQL injection, XSS, insecure deserialization, weak encryption.',
        'Memory: identify memory leaks, improper disposal, resource management.',
        'Performance: check for inefficient LINQ queries, unnecessary allocations.',
        'Code quality: verify proper exception handling, SOLID principles, design patterns.'
    ],
    'sql': [
        'Security: detect SQL injection risks, improper parameterization, exposed credentials.',
        'Performance: identify missing indexes, inefficient joins, N+1 query patterns.',
        'Data integrity: check for proper constraints, foreign keys, transaction handling.',
        'Best practices: verify proper normalization, query optimization, indexing strategy.'
    ],
    'html': [
        'Security: detect XSS vulnerabilities, unsafe inline scripts, missing CSRF tokens.',
        'Accessibility: check for proper ARIA labels, semantic HTML, keyboard navigation.',
        'Performance: identify render-blocking resources, missing lazy loading, inefficient markup.',
        'SEO: verify proper meta tags, heading structure, alt text for images.'
    ],
    'css': [
        'Performance: check for inefficient selectors, unused styles, missing optimization.',
        'Maintainability: verify proper organization, naming conventions, specificity issues.',
        'Browser compatibility: identify vendor prefix needs, fallback values.',
        'Best practices: check for proper use of variables, flexbox/grid, responsive design.'
    ],
    'default': [
        'Line-by-line analysis: examine each line for potential bugs, logic errors, edge cases.',
        'Security: check for injection risks, exposed secrets, improper validation.',
        'Performance: identify inefficient algorithms, memory leaks, unnecessary operations.',
        'Code quality: verify readability, maintainability, proper error handling.',
        'Best practices: check for consistent style, proper documentation, testability.'
    ]
};

export const getRulesForLanguage = (language: string): string[] => {
    return reviewRules[language] || reviewRules['default'];
};
