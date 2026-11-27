import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { tokenValue } from '../../../docs/token-reference';
import Heading from './Heading.vue';
import type { HeadingProps } from './Heading.vue';

type HeadingArgs = HeadingProps & { label: string; textColor: string };
const levels = [1, 2, 3, 4, 5, 6] as const;

const meta = {
  title: 'Components/Heading',
  id: 'warmsea-heading',
  component: Heading,
  parameters: { layout: 'padded' },
  argTypes: {
    level: {
      // Coerce URL args before Storybook validates them against numeric options.
      type: { name: 'number', required: true },
      control: 'select',
      options: levels,
    },
    label: {
      control: 'text',
      description: 'Default-slot content, not a component prop.',
    },
    textColor: {
      control: 'color',
      description: 'Playground-only --wui-color-text override.',
    },
  },
  args: {
    level: 1,
    label: 'Explore the coast',
    textColor: tokenValue('--wui-color-text'),
  },
} satisfies Meta<HeadingArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { Heading },
    setup: () => ({ args }),
    template: `
      <main class="wui-story">
        <p><strong>Heading playground</strong></p>
        <p>Choose the semantic rank deliberately. Level also determines size; local colors are consumer overrides.</p>
        <section aria-label="Interactive Heading" :style="{ '--wui-color-text': args.textColor }">
          <Heading :level="args.level">{{ args.label }}</Heading>
        </section>
      </main>
    `,
  }),
};

export const Demos: Story = {
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
    interactions: { disable: true },
  },
  render: () => ({
    components: { Heading },
    setup: () => ({ levels }),
    template: `
      <main class="wui-story">
        <p><strong>Heading demos</strong></p>
        <p>Six native ranks in order, with matching size tokens. Choose rank for document hierarchy, not appearance. Consumers own spacing.</p>
        <section class="wui-story-type-stack" aria-label="Heading levels">
          <Heading v-for="level in levels" :key="level" :level="level">Level {{ level }}: Explore the coast</Heading>
        </section>
      </main>
    `,
  }),
};
