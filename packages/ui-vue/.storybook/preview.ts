import type { Preview } from '@storybook/vue3-vite';
import '../../ui-tokens/src/index.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    docs: {
      // Source already renders its own pre; keep its Copy control outside the patched block.
      components: { pre: 'div' },
    },
    options: {
      storySort: {
        includeNames: true,
        order: [
          'Getting started',
          ['Overview', 'Installation'],
          'Foundations',
          ['Colors', 'Typography', 'Spacing', 'Customization'],
          'Components',
          [
            'Menu',
            ['Docs', 'Demos', 'Playground'],
            'AppBar',
            ['Docs', 'Demos', 'Playground'],
            'Button',
            ['Docs', 'Demos', 'Playground'],
            'Heading',
            ['Docs', 'Demos', 'Playground'],
            'Select',
            ['Docs', 'Demos', 'Playground'],
            'Input',
            ['Docs', 'Demos', 'Playground'],
            'Text',
            ['Docs', 'Demos', 'Playground'],
            'Tooltip',
            ['Docs', 'Demos', 'Playground'],
          ],
        ],
      },
    },
    layout: 'centered',
    controls: { expanded: true },
    backgrounds: {
      options: {
        white: { name: 'White', value: '#ffffff' },
        seafoam: { name: 'Seafoam', value: '#f0fdfa' },
      },
    },
  },
};

export default preview;
