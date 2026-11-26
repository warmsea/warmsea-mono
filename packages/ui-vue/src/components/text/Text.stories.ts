import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { tokenValue } from '../../../docs/token-reference';
import Text from './Text.vue';
import type { TextProps } from './Text.vue';

type TextArgs = TextProps & { label: string; textColor: string };
const weights = ['regular', 'semibold'] as const;

const meta = {
  title: 'Components/Text',
  id: 'warmsea-text',
  component: Text,
  parameters: { layout: 'padded' },
  argTypes: {
    as: {
      control: 'inline-radio',
      options: ['p', 'span'],
      description: 'HTML element: p for a paragraph, span for inline text.',
    },
    weight: { control: 'inline-radio', options: weights },
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
    as: 'p',
    weight: 'regular',
    label: 'A quiet place to begin.',
    textColor: tokenValue('--wui-color-text'),
  },
} satisfies Meta<TextArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { Text },
    setup: () => ({ args }),
    template: `
      <main class="wui-story">
        <h1>Text playground</h1>
        <p>Change the HTML element, weight, slot content, or local text color in Controls.</p>
        <section aria-label="Interactive Text" :style="{ '--wui-color-text': args.textColor }">
          <Text :as="args.as" :weight="args.weight">{{ args.label }}</Text>
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
    components: { Text },
    setup: () => ({ weights }),
    template: `
      <main class="wui-story wui-story-demos">
        <h1>Text demos</h1>
        <p>Fixed comparisons. Use Playground to change props. Components have zero margins; this gallery supplies its own spacing.</p>
        <section id="text-weights" aria-label="Text weights">
          <h2>Weights</h2>
          <div class="wui-story-type-stack">
            <Text v-for="weight in weights" :key="weight" :weight="weight">{{ weight }}: Explore the coast.</Text>
          </div>
        </section>
        <section id="text-roots" aria-label="Text HTML elements">
          <h2>HTML elements</h2>
          <p>The as prop chooses p for a paragraph or span for inline text.</p>
          <Text>A native paragraph for a complete thought.</Text>
          <p>Native inline text: <Text as="span" weight="semibold">part of this sentence</Text>.</p>
        </section>
      </main>
    `,
  }),
};
