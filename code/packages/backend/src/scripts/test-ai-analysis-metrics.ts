#!/usr/bin/env node
/**
 * Test AI Analysis API with 5 different test cases
 * Tests different metrics: quality, sentiment, wordiness, clarity
 * 
 * Usage: DISABLE_AUTH=true pnpm tsx src/scripts/test-ai-analysis-metrics.ts
 */

import 'dotenv/config';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

interface TestCase {
  name: string;
  description: string;
  text: string;
  expectedMetrics: {
    quality?: { min?: number; max?: number }; // 0-100
    sentiment?: 'positive' | 'neutral' | 'negative';
    wordiness?: { min?: number; max?: number }; // 0-100 (higher = more wordy)
    clarity?: { min?: number; max?: number }; // 0-100 (higher = clearer)
  };
}

const testCases: TestCase[] = [
  {
    name: 'High Quality Text',
    description: 'Well-written, clear, concise text with positive tone',
    text: `The implementation demonstrates exceptional clarity and precision. 
The code follows best practices and maintains high readability. 
Each function serves a single, well-defined purpose.`,
    expectedMetrics: {
      quality: { min: 70, max: 100 },
      sentiment: 'positive',
      wordiness: { min: 0, max: 40 },
      clarity: { min: 70, max: 100 },
    },
  },
  {
    name: 'Wordy/Verbose Text',
    description: 'Text with excessive words and redundancy',
    text: `In order to be able to successfully complete the task at hand, 
it is very important that we make sure to carefully consider all of the 
various different options that are available to us, and then proceed 
to make a decision about which one we should choose to implement.`,
    expectedMetrics: {
      quality: { min: 0, max: 60 },
      sentiment: 'neutral',
      wordiness: { min: 60, max: 100 },
      clarity: { min: 0, max: 50 },
    },
  },
  {
    name: 'Low Clarity Text',
    description: 'Confusing, unclear, or poorly structured text',
    text: `The thing is, you know, it's like when you have this stuff 
that happens, and then there's the other part that kind of does 
something, but not really in the way you'd think, but maybe it could 
work if we change how it, you know, works or something.`,
    expectedMetrics: {
      quality: { min: 0, max: 50 },
      sentiment: 'neutral',
      wordiness: { min: 30, max: 80 },
      clarity: { min: 0, max: 40 },
    },
  },
  {
    name: 'Negative Sentiment Text',
    description: 'Text with negative or critical tone',
    text: `Unfortunately, this approach has significant drawbacks and fails 
to address the core issues. The implementation is flawed and creates 
more problems than it solves. We must reconsider our strategy.`,
    expectedMetrics: {
      quality: { min: 30, max: 80 },
      sentiment: 'negative',
      wordiness: { min: 0, max: 50 },
      clarity: { min: 40, max: 90 },
    },
  },
  {
    name: 'Neutral Technical Text',
    description: 'Factual, neutral technical documentation',
    text: `The system processes requests through a series of middleware 
functions. Each request is validated before being forwarded to the 
appropriate handler. Response data is serialized in JSON format.`,
    expectedMetrics: {
      quality: { min: 50, max: 100 },
      sentiment: 'neutral',
      wordiness: { min: 0, max: 50 },
      clarity: { min: 60, max: 100 },
    },
  },
];

async function testAnalysis(testCase: TestCase): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test Case: ${testCase.name}`);
  console.log(`Description: ${testCase.description}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Input Text:\n${testCase.text}\n`);

  try {
    const response = await fetch(`${API_BASE_URL}/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.DISABLE_AUTH !== 'true' && process.env.AUTH_TOKEN
          ? { Authorization: `Bearer ${process.env.AUTH_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        text: testCase.text,
        model: 'openai',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ API Error (${response.status}):`, errorData);
      return;
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      console.error('❌ API returned unsuccessful response:', result);
      return;
    }

    const analysis = result.data;
    console.log('✅ Analysis Results:');
    console.log(`  Quality: ${analysis.quality.toFixed(1)} (expected: ${testCase.expectedMetrics.quality?.min || 0}-${testCase.expectedMetrics.quality?.max || 100})`);
    console.log(`  Sentiment: ${analysis.sentiment} (expected: ${testCase.expectedMetrics.sentiment || 'any'})`);
    console.log(`  Wordiness: ${analysis.wordiness.toFixed(1)} (expected: ${testCase.expectedMetrics.wordiness?.min || 0}-${testCase.expectedMetrics.wordiness?.max || 100})`);
    console.log(`  Clarity: ${analysis.clarity.toFixed(1)} (expected: ${testCase.expectedMetrics.clarity?.min || 0}-${testCase.expectedMetrics.clarity?.max || 100})`);
    console.log(`  Model: ${analysis.model || 'unknown'}`);
    console.log(`  Suggestions: ${analysis.suggestions?.length || 0} items`);

    // Validate metrics
    let allValid = true;
    
    if (testCase.expectedMetrics.quality) {
      const { min = 0, max = 100 } = testCase.expectedMetrics.quality;
      if (analysis.quality < min || analysis.quality > max) {
        console.error(`  ❌ Quality out of range: ${analysis.quality} (expected ${min}-${max})`);
        allValid = false;
      } else {
        console.log(`  ✅ Quality within expected range`);
      }
    }

    if (testCase.expectedMetrics.sentiment) {
      if (analysis.sentiment !== testCase.expectedMetrics.sentiment) {
        console.error(`  ❌ Sentiment mismatch: ${analysis.sentiment} (expected ${testCase.expectedMetrics.sentiment})`);
        allValid = false;
      } else {
        console.log(`  ✅ Sentiment matches expected`);
      }
    }

    if (testCase.expectedMetrics.wordiness) {
      const { min = 0, max = 100 } = testCase.expectedMetrics.wordiness;
      if (analysis.wordiness < min || analysis.wordiness > max) {
        console.error(`  ❌ Wordiness out of range: ${analysis.wordiness} (expected ${min}-${max})`);
        allValid = false;
      } else {
        console.log(`  ✅ Wordiness within expected range`);
      }
    }

    if (testCase.expectedMetrics.clarity) {
      const { min = 0, max = 100 } = testCase.expectedMetrics.clarity;
      if (analysis.clarity < min || analysis.clarity > max) {
        console.error(`  ❌ Clarity out of range: ${analysis.clarity} (expected ${min}-${max})`);
        allValid = false;
      } else {
        console.log(`  ✅ Clarity within expected range`);
      }
    }

    // Show suggestions if any
    if (analysis.suggestions && analysis.suggestions.length > 0) {
      console.log(`\n  Suggestions (${analysis.suggestions.length}):`);
      analysis.suggestions.slice(0, 3).forEach((sug, idx: number) => {
        console.log(`    ${idx + 1}. [${sug.type}] ${sug.message || sug.text}`);
      });
      if (analysis.suggestions.length > 3) {
        console.log(`    ... and ${analysis.suggestions.length - 3} more`);
      }
    }

    if (allValid) {
      console.log(`\n✅ All metrics validated successfully for "${testCase.name}"`);
    } else {
      console.log(`\n⚠️  Some metrics are outside expected ranges for "${testCase.name}"`);
    }
  } catch (error) {
    console.error(`❌ Error testing "${testCase.name}":`, error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('🧪 AI Analysis Metrics Test Suite');
  console.log(`Testing API at: ${API_BASE_URL}`);
  console.log(`Auth: ${process.env.DISABLE_AUTH === 'true' ? 'DISABLED (development mode)' : 'REQUIRED'}`);

  if (process.env.DISABLE_AUTH !== 'true' && !process.env.AUTH_TOKEN) {
    console.warn('\n⚠️  WARNING: AUTH_TOKEN not set. Set DISABLE_AUTH=true for local testing.');
  }

  for (const testCase of testCases) {
    await testAnalysis(testCase);
    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ Test suite completed');
  console.log(`${'='.repeat(80)}\n`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

