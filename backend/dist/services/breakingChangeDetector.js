"use strict";
/**
 * Breaking Change Detector
 * Detects API breaking changes in code
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBreakingChangeReport = exports.detectBreakingChanges = void 0;
/**
 * Detect breaking changes in TypeScript/JavaScript
 */
const detectBreakingChanges = async (files) => {
    const breakingChanges = [];
    for (const file of files) {
        // Check for function signature changes
        const signatureChanges = detectSignatureChanges(file.filename, file.patch);
        breakingChanges.push(...signatureChanges);
        // Check for removed exports
        const removedExports = detectRemovedExports(file.filename, file.patch);
        breakingChanges.push(...removedExports);
        // Check for behavior changes
        const behaviorChanges = detectBehaviorChanges(file.filename, file.patch);
        breakingChanges.push(...behaviorChanges);
    }
    return breakingChanges;
};
exports.detectBreakingChanges = detectBreakingChanges;
/**
 * Detect function signature changes
 */
function detectSignatureChanges(filename, patch) {
    const changes = [];
    // Look for function/class definition changes
    const functionRegex = /(?:function|const|export\s+(?:function|const|class))\s+(\w+)\s*\([^)]*\)/g;
    const lines = patch.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check if a function is being modified (removed or changed)
        if (line.startsWith('-') && functionRegex.test(line)) {
            const match = line.match(functionRegex);
            if (match) {
                changes.push({
                    type: 'api_signature',
                    file: filename,
                    line: i + 1,
                    description: `Function signature changed: ${match[0]}`,
                    impact: 'high',
                });
            }
        }
    }
    return changes;
}
/**
 * Detect removed exports
 */
function detectRemovedExports(filename, patch) {
    const changes = [];
    const lines = patch.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for removed exports
        if (line.startsWith('-') && /export\s+(?:const|function|class|interface|type)/.test(line)) {
            const match = line.match(/export\s+(?:const|function|class|interface|type)\s+(\w+)/);
            if (match) {
                changes.push({
                    type: 'removed_export',
                    file: filename,
                    line: i + 1,
                    description: `Removed export: ${match[1]}`,
                    impact: 'high',
                    migrationPath: `Update imports to use new export or remove usage`,
                });
            }
        }
    }
    return changes;
}
/**
 * Detect behavior changes
 */
function detectBehaviorChanges(filename, patch) {
    const changes = [];
    // Look for changes in return types, error handling, etc.
    // This is simplified - in production, use AST analysis
    const returnTypeRegex = /:\s*([A-Z]\w+)/g;
    const lines = patch.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for return type changes
        if ((line.startsWith('-') || line.startsWith('+')) && returnTypeRegex.test(line)) {
            changes.push({
                type: 'behavior_change',
                file: filename,
                line: i + 1,
                description: 'Return type or behavior may have changed',
                impact: 'medium',
            });
        }
    }
    return changes;
}
/**
 * Generate breaking change report
 */
const generateBreakingChangeReport = (changes) => {
    if (changes.length === 0) {
        return '✅ No breaking changes detected.';
    }
    let report = `## Breaking Changes Detected\n\n`;
    report += `**Total Breaking Changes:** ${changes.length}\n\n`;
    const byType = changes.reduce((acc, change) => {
        acc[change.type] = (acc[change.type] || 0) + 1;
        return acc;
    }, {});
    report += `### Summary\n`;
    for (const [type, count] of Object.entries(byType)) {
        report += `- ${type}: ${count}\n`;
    }
    report += `\n`;
    report += `### Details\n\n`;
    for (const change of changes) {
        report += `#### ${change.file}:${change.line}\n`;
        report += `- **Type:** ${change.type}\n`;
        report += `- **Impact:** ${change.impact.toUpperCase()}\n`;
        report += `- **Description:** ${change.description}\n`;
        if (change.migrationPath) {
            report += `- **Migration:** ${change.migrationPath}\n`;
        }
        report += `\n`;
    }
    return report;
};
exports.generateBreakingChangeReport = generateBreakingChangeReport;
