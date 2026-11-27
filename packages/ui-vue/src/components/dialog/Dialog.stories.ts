import { ref } from 'vue';
import { useArgs } from 'storybook/preview-api';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Button from '../button/Button.vue';
import Heading from '../heading/Heading.vue';
import Text from '../text/Text.vue';
import Dialog from './Dialog.vue';
const meta = {
  title: 'Components/Dialog',
  id: 'warmsea-dialog',
  component: Dialog,
  parameters: { layout: 'padded' },
  args: { modelValue: false, title: 'Review destination' },
} satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { Dialog, Button, Heading, Text },
      setup: () => ({
        args,
        update: (modelValue: boolean) => updateArgs({ modelValue }),
      }),
      template: `<main class="wui-story"><Heading :level="1">Dialog playground</Heading>
        <Button @click="update(true)">Open dialog</Button>
        <Dialog v-bind="args" @update:model-value="update"><Text>Review the destination before continuing.</Text>
          <template #footer><Button variant="default" @click="update(false)">Close dialog</Button></template>
        </Dialog></main>`,
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
    components: { Dialog, Button, Heading, Text },
    setup: () => ({ open: ref(false) }),
    template: `<main class="wui-story"><Heading :level="1">Dialog demos</Heading>
      <Text>The native modal contains focus and closes with Escape.</Text>
      <Button @click="open = true">Review destination</Button>
      <Dialog v-model="open" title="Review destination"><Text>Your destination is the coast.</Text>
        <template #footer><Button variant="default" @click="open = false">Return to destinations</Button></template>
      </Dialog></main>`,
  }),
};
