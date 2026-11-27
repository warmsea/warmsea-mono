import { useArgs } from 'storybook/preview-api';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import ChatInput from './ChatInput.vue';
import Demo from './ChatInput.demo.vue';
const meta = {
  title: 'Components/ChatInput',
  id: 'warmsea-ai-chat-input',
  component: ChatInput,
  args: {
    modelValue: '',
    label: 'Message',
    submitLabel: 'Send',
    canSubmit: true,
    keyboardHint: 'Enter to send. Shift+Enter for a new line.',
  },
} satisfies Meta<typeof ChatInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Demos: Story = {
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
    interactions: { disable: true },
  },
  render: () => ({ components: { Demo }, template: '<Demo />' }),
};
export const Playground: Story = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { ChatInput },
      setup: () => ({
        args,
        update: (modelValue: string) => updateArgs({ modelValue }),
      }),
      template: '<ChatInput v-bind="args" @update:model-value="update" />',
    };
  },
};
