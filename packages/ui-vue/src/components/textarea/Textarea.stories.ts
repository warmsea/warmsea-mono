import { ref } from 'vue';
import { useArgs } from 'storybook/preview-api';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Heading from '../heading/Heading.vue';
import Text from '../text/Text.vue';
import Textarea from './Textarea.vue';
const meta = {
  title: 'Components/Textarea',
  id: 'warmsea-textarea',
  component: Textarea,
  parameters: { layout: 'padded' },
  args: {
    modelValue: '',
    label: 'Notes',
    helpText: 'Describe your destination.',
  },
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { Textarea, Heading },
      setup: () => ({
        args,
        update: (modelValue: string) => updateArgs({ modelValue }),
      }),
      template:
        '<main class="wui-story"><Heading :level="1">Textarea playground</Heading><Textarea v-bind="args" @update:model-value="update" /></main>',
    };
  },
};
export const Demos: Story = {
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
    interactions: { disable: true },
  },
  render: () => ({
    components: { Textarea, Heading, Text },
    setup: () => ({ notes: ref('A quiet coast') }),
    template: `<main class="wui-story"><Heading :level="1">Textarea demos</Heading>
      <Text>Native multiline editing, descriptions, and read-only states.</Text>
      <Textarea v-model="notes" label="Destination notes" help-text="Use multiple lines." />
      <Textarea model-value="Unavailable" label="Disabled notes" disabled />
      <Textarea model-value="Stored notes" label="Readonly notes" readonly />
      <Textarea model-value="" label="Required notes" error-text="Enter your notes." />
      <section style="padding: 1rem; border: var(--wui-border-width) solid var(--wui-color-border); border-radius: var(--wui-radius-control)">
        <Textarea v-model="notes" appearance="embedded" label="Embedded notes" help-text="A field inside a consumer-owned surface." />
      </section>
    </main>`,
  }),
};
