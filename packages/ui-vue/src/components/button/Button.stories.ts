import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { fn } from 'storybook/test';
import { ref } from 'vue';
import Button from './Button.vue';
import type { ButtonProps } from './Button.vue';

type ButtonArgs = ButtonProps & {
  label: string;
  palette: Record<string, string>;
  onClick: (event: MouseEvent) => void;
};

const variants = ['primary', 'default', 'outlined', 'subtle'] as const;

const meta = {
  title: 'Components/Button',
  id: 'warmsea-button',
  component: Button,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: variants },
    disabled: { control: 'boolean' },
    type: { control: 'select', options: ['button', 'submit', 'reset'] },
    label: {
      control: 'text',
      description: 'Content of the default slot, not a component prop.',
    },
    palette: {
      control: 'object',
      description:
        'Playground-only CSS token palette. Empty inherits ocean; provide the complete relevant state group for a custom theme. Base-only overrides do not derive states.',
    },
    onClick: {
      control: false,
      description: 'Native click listener, logged in Actions.',
    },
  },
  args: {
    variant: 'primary',
    disabled: false,
    type: 'button',
    label: 'Set sail',
    palette: {},
    onClick: fn<(event: MouseEvent) => void>(),
  },
} satisfies Meta<ButtonArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: `
      <main class="wui-story">
        <h1>Button playground</h1>
        <p>Change props, slot text, and the explicit local token palette in Controls. Supply complete state groups as described in Foundations / Customization; no local colors are derived automatically. Native clicks appear in Actions.</p>
        <section aria-label="Interactive Button">
          <div :style="args.palette">
            <Button :variant="args.variant" :disabled="args.disabled" :type="args.type" @click="args.onClick">
              {{ args.label }}
            </Button>
          </div>
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
    components: { Button },
    setup: () => ({
      variants,
    }),
    template: `
      <main class="wui-story wui-story-demos">
        <h1>Button demos</h1>
        <p>Compare every supported configuration on one page. These examples stay fixed; use the separate Playground to experiment with Controls.</p>
        <section id="button-variants" aria-label="Button variants">
          <h2>Variants</h2>
          <p>Compare all four appearances with shared text metrics and padding. Subtle has no visible border; keyboard focus remains visible.</p>
          <div class="wui-story-row">
            <Button v-for="variant in variants" :key="variant" :variant="variant">{{ variant.charAt(0).toUpperCase() + variant.slice(1) }}</Button>
          </div>
        </section>

        <section id="button-states" aria-label="Button states">
          <h2>States</h2>
          <p tabindex="-1" data-testid="state-start">
            Hover, press, or Tab through enabled buttons. Disabled buttons are skipped.
            All variants share the same disabled appearance, without a visible border.
            Keyboard focus is shown through real interaction, not a simulated state prop.
          </p>
          <div class="wui-story-row">
            <Button variant="default">Enabled</Button>
            <Button variant="default" disabled>Disabled</Button>
          </div>
        </section>

        <section id="button-types" aria-label="Button types">
          <h2>Types</h2>
          <p>Type controls form behavior, not appearance.</p>
          <div class="wui-story-row">
            <Button variant="default">Button</Button>
            <Button type="submit" variant="default">Submit</Button>
            <Button type="reset" variant="default">Reset</Button>
          </div>
        </section>

      </main>
    `,
  }),
};

export const FormBehavior: Story = {
  tags: ['!dev'],
  parameters: { controls: { disable: true } },
  render: () => ({
    components: { Button },
    setup: () => ({
      submits: ref(0),
      resets: ref(0),
    }),
    template: `
      <section class="wui-story" aria-label="Button form behavior">
        <form @submit.prevent="submits++" @reset="resets++">
          <label for="docs-destination">Destination</label>
          <input id="docs-destination" name="destination" value="Warmsea" />
          <div class="wui-story-row">
            <Button variant="default">Default button</Button>
            <Button type="submit" variant="default">Submit</Button>
            <Button type="reset" variant="default">Reset</Button>
          </div>
          <output aria-live="polite">Submissions: {{ submits }} / Resets: {{ resets }}</output>
        </form>
      </section>
    `,
  }),
};
