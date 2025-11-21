export default {
  input: 'https://api.letz.ai/doc-yaml',
  output: 'src/lib/letzai/sdk',
  plugins: [
    {
      name: '@hey-api/client-fetch',
      runtimeConfigPath: '@/lib/letzai/letzai-runtime-config',
    },
  ],
};
