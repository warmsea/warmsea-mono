import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  stories: [
    '../docs/**/*.mdx',
    '../src/**/*.mdx',
    '../src/**/*.stories.ts',
    ...(process.env.WUI_STORYBOOK_CONTRACTS === '1'
      ? ['../tests/fixtures/**/*.stories.ts']
      : []),
  ],
  addons: [
    '@storybook/addon-docs',
    {
      name: '@lukethacoder/storybook-addon-shiki',
      options: {
        shiki: {
          theme: 'github-light-default',
          langs: [
            'vue',
            'jsx',
            'tsx',
            'typescript',
            'javascript',
            'css',
            'html',
            'bash',
            'json',
            'yaml',
            'markdown',
            'graphql',
          ],
        },
      },
    },
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: { docgen: 'vue-component-meta' },
  },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(config, {
      server: {
        watch: {
          ignored: [
            /(?:^|[/\\])(?:\.artifacts|storybook-static|dist)(?:[/\\]|$)/,
          ],
        },
      },
    });
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
};

export default config;
