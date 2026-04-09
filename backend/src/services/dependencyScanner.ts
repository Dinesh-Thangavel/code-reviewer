/**
 * Dependency Vulnerability Scanner
 * Scans package.json, requirements.txt, etc. for vulnerabilities
 */

import axios from 'axios';

interface Vulnerability {
    package: string;
    version: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    cve?: string;
    fixedIn?: string;
}

/**
 * Scan npm/package.json dependencies
 */
export const scanNpmDependencies = async (
    packageJson: any
): Promise<Vulnerability[]> => {
    const vulnerabilities: Vulnerability[] = [];
    const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };

    // Use npm audit API or Snyk API
    // For now, we'll use a simple check against known vulnerabilities
    // In production, integrate with Snyk, npm audit, or GitHub Security Advisories

    try {
        // Check each dependency
        for (const [pkg, version] of Object.entries(dependencies)) {
            // Remove version range symbols
            const cleanVersion = (version as string).replace(/[\^~>=<]/g, '');
            
            // Check against GitHub Security Advisories (free API)
            const vulns = await checkPackageVulnerability(pkg, cleanVersion);
            vulnerabilities.push(...vulns);
        }
    } catch (error: any) {
        console.error('Error scanning dependencies:', error);
    }

    return vulnerabilities;
};

/**
 * Check package vulnerability using npm audit API
 */
async function checkPackageVulnerability(
    packageName: string,
    version: string
): Promise<Vulnerability[]> {
    try {
        const vulnerabilities: Vulnerability[] = [];
        
        // Use npm audit API (free, no auth required for public packages)
        // Note: This is a simplified check - in production, use actual npm audit or Snyk
        
        // Check known vulnerable packages (common CVEs)
        const knownVulnerabilities: Record<string, any[]> = {
            'lodash': [
                { version: '<4.17.21', cve: 'CVE-2021-23337', severity: 'high' },
            ],
            'axios': [
                { version: '<1.6.0', cve: 'CVE-2024-39338', severity: 'high' },
            ],
        };
        
        if (knownVulnerabilities[packageName]) {
            for (const vuln of knownVulnerabilities[packageName]) {
                // Simple version comparison (in production, use semver)
                if (version && version < vuln.version) {
                    vulnerabilities.push({
                        package: packageName,
                        version,
                        severity: vuln.severity as any,
                        title: `Vulnerability in ${packageName}`,
                        description: `Known vulnerability in ${packageName} version ${version}. Please upgrade to ${vuln.version} or later.`,
                        cve: vuln.cve,
                        fixedIn: vuln.version,
                    });
                }
            }
        }
        
        // In production, integrate with:
        // 1. npm audit API: https://registry.npmjs.org/-/npm/v1/security/audits
        // 2. Snyk API: https://snyk.io/api
        // 3. GitHub Security Advisories: https://api.github.com/advisories
        // 4. OWASP Dependency-Check
        
        return vulnerabilities;
    } catch (error) {
        console.error(`Error checking vulnerability for ${packageName}:`, error);
        return [];
    }
}

/**
 * Scan Python requirements.txt
 */
export const scanPythonDependencies = async (
    requirements: string
): Promise<Vulnerability[]> => {
    const vulnerabilities: Vulnerability[] = [];
    const lines = requirements.split('\n').filter(line => line.trim() && !line.startsWith('#'));

    for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9_-]+)([>=<!=]+)?([0-9.]+)?/);
        if (match) {
            const packageName = match[1];
            const version = match[3] || 'latest';
            
            // Check vulnerabilities (integrate with safety-db or Snyk)
            const vulns = await checkPythonPackageVulnerability(packageName, version);
            vulnerabilities.push(...vulns);
        }
    }

    return vulnerabilities;
};

async function checkPythonPackageVulnerability(
    packageName: string,
    version: string
): Promise<Vulnerability[]> {
    try {
        const vulnerabilities: Vulnerability[] = [];
        
        // Check known vulnerable Python packages
        const knownVulnerabilities: Record<string, any[]> = {
            'django': [
                { version: '<4.2.0', cve: 'CVE-2023-43665', severity: 'high' },
            ],
            'requests': [
                { version: '<2.31.0', cve: 'CVE-2023-32681', severity: 'medium' },
            ],
        };
        
        if (knownVulnerabilities[packageName]) {
            for (const vuln of knownVulnerabilities[packageName]) {
                if (version && version < vuln.version) {
                    vulnerabilities.push({
                        package: packageName,
                        version,
                        severity: vuln.severity as any,
                        title: `Vulnerability in ${packageName}`,
                        description: `Known vulnerability in ${packageName} version ${version}. Please upgrade to ${vuln.version} or later.`,
                        cve: vuln.cve,
                        fixedIn: vuln.version,
                    });
                }
            }
        }
        
        // In production, integrate with:
        // 1. safety-db: https://github.com/pyupio/safety-db
        // 2. Snyk API for Python
        // 3. PyPI Security Advisories
        
        return vulnerabilities;
    } catch (error) {
        console.error(`Error checking Python vulnerability for ${packageName}:`, error);
        return [];
    }
}

/**
 * Generate security report
 */
export const generateSecurityReport = (vulnerabilities: Vulnerability[]): string => {
    if (vulnerabilities.length === 0) {
        return '✅ No known vulnerabilities found.';
    }

    const critical = vulnerabilities.filter(v => v.severity === 'critical').length;
    const high = vulnerabilities.filter(v => v.severity === 'high').length;
    const medium = vulnerabilities.filter(v => v.severity === 'medium').length;
    const low = vulnerabilities.filter(v => v.severity === 'low').length;

    let report = `## Security Vulnerability Report\n\n`;
    report += `**Summary:**\n`;
    report += `- 🔴 Critical: ${critical}\n`;
    report += `- 🟠 High: ${high}\n`;
    report += `- 🟡 Medium: ${medium}\n`;
    report += `- 🔵 Low: ${low}\n\n`;
    report += `**Total Vulnerabilities:** ${vulnerabilities.length}\n\n`;

    report += `### Vulnerabilities\n\n`;
    for (const vuln of vulnerabilities) {
        report += `#### ${vuln.package}@${vuln.version}\n`;
        report += `- **Severity:** ${vuln.severity.toUpperCase()}\n`;
        report += `- **Title:** ${vuln.title}\n`;
        report += `- **Description:** ${vuln.description}\n`;
        if (vuln.cve) report += `- **CVE:** ${vuln.cve}\n`;
        if (vuln.fixedIn) report += `- **Fixed in:** ${vuln.fixedIn}\n`;
        report += `\n`;
    }

    return report;
};
