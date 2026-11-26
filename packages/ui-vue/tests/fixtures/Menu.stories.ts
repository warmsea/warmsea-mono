import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { Menu, Button, Heading } from '../../src';
import './contract.css';
export default {
  title: 'Contracts/Menu',
  id: 'wui-contract-menu',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export const Interactions: StoryObj = {
  render: () => ({
    components: { Menu, Button, Heading },
    setup() {
      const selectedAction = ref('None');
      return { selectedAction };
    },
    template: `<main class="wui-contract"><h1>Menu contracts</h1>
    <section aria-labelledby="actions-title" data-testid="menu-fixture">
      <Heading id="actions-title" :level="2">Action menu</Heading>
      <Button variant="default">Before actions</Button>
      <Menu
        label="Conversation actions"
        :items="[
          { id: 'rename', label: 'Rename' },
          { id: 'disabled', label: 'Unavailable', disabled: true },
          { id: 'archive', label: 'Archive' },
          { id: 'reset', label: 'Reset conversation' },
        ]"
        @select="selectedAction = $event.label"
        >Actions</Menu
      >
      <Button variant="default">After actions</Button>
      <output aria-live="polite" data-testid="selected-action">{{
        selectedAction
      }}</output>
    </section>

    </main>`,
  }),
};
