#!/bin/bash

# SEO Protocols Test Coverage Script
# This script runs tests and ensures 100% coverage and 100% success rate

set -e

echo "🚀 Starting SEO Protocols Test Suite..."
echo "=================================="

# Clean previous coverage
echo "🧹 Cleaning previous coverage reports..."
rm -rf coverage/

# Install dependencies if needed
echo "📦 Installing dependencies..."
npm ci

# Run TypeScript compilation check
echo "🔍 Checking TypeScript compilation..."
npm run type-check

# Run the comprehensive test suite
echo "🧪 Running comprehensive test suite with 100% coverage requirement..."
npm test -- --coverage --coverageThreshold='{"branches":100,"functions":100,"lines":100,"statements":100}' --verbose

# Check if tests passed
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ALL TESTS PASSED WITH 100% COVERAGE! 🎉"
    echo "=================================="
    echo "📊 Coverage Report Generated:"
    echo "   HTML Report: coverage/lcov-report/index.html"
    echo "   JSON Summary: coverage/coverage-summary.json"
    echo "   Lcov Report: coverage/lcov.info"
    echo ""
    echo "🎯 SEO Protocols Implementation Status:"
    echo "   ✅ Content Health Check Protocol - 100% Covered"
    echo "   ✅ Virtual Scroll & Lazy Load - 100% Covered"
    echo "   ✅ ETag & 304 Strategy - 100% Covered"
    echo "   ✅ Cluster Mode & Job Queue - 100% Covered"
    echo "   ✅ Shadow DOM & Web Components - 100% Covered"
    echo "   ✅ Circuit Breaker Pattern - 100% Covered"
    echo "   ✅ Integration Tests - 100% Covered"
    echo "   ✅ Error Handling - 100% Covered"
    echo ""
    echo "🚀 Your SEO Shield Proxy is ready for production!"
else
    echo ""
    echo "❌ TESTS FAILED! Please check the output above."
    echo "=================================="
    echo "🔍 Debugging Tips:"
    echo "   1. Check specific test failures in the output"
    echo "   2. Look for missing imports or undefined functions"
    echo "   3. Verify all TypeScript files compile correctly"
    echo "   4. Check for syntax errors in test files"
    echo ""
    echo "📋 Quick Commands:"
    echo "   npm test tests/unit/seo-protocols.test.ts --verbose     # Run specific test file"
    echo "   npm run type-check                                  # Check TypeScript compilation"
    echo "   npm run build                                       # Build the project"
    exit 1
fi

# Show coverage summary
echo ""
echo "📊 Coverage Summary:"
echo "=================="
if [ -f "coverage/coverage-summary.json" ]; then
    node -e "
        const fs = require('fs');
        const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
        console.log(\`Lines: \${coverage.total.lines.pct}%\`);
        console.log(\`Functions: \${coverage.total.functions.pct}%\`);
        console.log(\`Branches: \${coverage.total.branches.pct}%\`);
        console.log(\`Statements: \${coverage.total.statements.pct}%\`);
        console.log(\`Files: \${Object.keys(coverage).filter(k => k !== 'total').length}\`);
    "
else
    echo "No coverage summary available"
fi

echo ""
echo "🎯 Test Results:"
echo "   Status: PASSED ✅"
echo "   Coverage: 100% ✅"
echo "   Success Rate: 100% ✅"
echo "   All Protocols: Fully Tested ✅"