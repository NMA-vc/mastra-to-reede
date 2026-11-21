// A Mastra agent on a mock model, exporting its traces over OTLP/HTTP protobuf to `reede serve`.
// No API key and no network model call: the model is the AI SDK's own mock.
//
// Real model: set REEDE_EXAMPLE_BASE_URL, REEDE_EXAMPLE_API_KEY and REEDE_EXAMPLE_MODEL (any
// OpenAI-compatible endpoint); Mastra takes { id: 'openai/<model>', url, apiKey }. See the README.
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { Observability } from '@mastra/observability';
import { OtelExporter } from '@mastra/otel-exporter';
import { MockLanguageModelV3 } from 'ai/test';
import { reedeOtel } from '@reede/otel';

const mock = new MockLanguageModelV3({
  doGenerate: async () => ({
    content: [{ type: 'text', text: 'a reported receipt proves what was reported' }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 12, noCache: 12 },
      outputTokens: { total: 7, text: 7 },
    },
    warnings: [],
  }),
});

const e = process.env;
const model = e.REEDE_EXAMPLE_BASE_URL
  ? { id: `openai/${e.REEDE_EXAMPLE_MODEL}`, url: e.REEDE_EXAMPLE_BASE_URL, apiKey: e.REEDE_EXAMPLE_API_KEY }
  : mock;

const agent = new Agent({ id: 'demo', name: 'demo', instructions: 'Answer briefly.', model });

const { endpoint, headers } = reedeOtel();
const mastra = new Mastra({
  agents: { agent },
  observability: new Observability({
    configs: {
      reede: {
        serviceName: 'reede-mastra-example',
        exporters: [new OtelExporter({ provider: { custom: { endpoint, headers, protocol: 'http/protobuf' } } })],
      },
    },
  }),
});

const res = await mastra.getAgent('agent').generate('What does a reported receipt prove?');
console.log(res.text);
await mastra.shutdown?.(); // flushes the batch exporter
