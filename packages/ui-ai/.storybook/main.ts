import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.ts'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/vue3-vite',
    options: { docgen: 'vue-component-meta' },
  },
  core: {
    disableTelemetry: true,
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: fileURLToPath(
          new URL('./vite.config.ts', import.meta.url),
        ),
      },
    },
  },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(config, {
      server: {
        watch: { ignored: [/(?:^|[/\\])(?:\.artifacts|dist)(?:[/\\]|$)/] },
      },
    });
  },
};
export default config;
