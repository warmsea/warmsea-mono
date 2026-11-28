import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import Menu from './Menu.vue';
import Text from '../text/Text.vue';
import Heading from '../heading/Heading.vue';
const meta = {
  title: 'Components/Menu',
  id: 'warmsea-menu',
  component: Menu,
  args: {
    label: 'Conversation actions',
    items: [
      { id: 'rename', label: 'Rename' },
      { id: 'archive', label: 'Archive' },
      { id: 'delete', label: 'Delete', disabled: true },
    ],
  },
} satisfies Meta<typeof Menu>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Playground: Story = {};
export const Demos: Story = {
  parameters: {
    controls: { disable: true },
    actions: { disable: true },
    interactions: { disable: true },
  },
  render: () => ({
    components: { Menu, Text, Heading },
    setup: () => ({ selected: ref('None') }),
    template: `<main><Heading :level="1">Menu demos</Heading><Menu label="Conversation actions" :items="[{id:'rename',label:'Rename'},{id:'archive',label:'Archive'},{id:'delete',label:'Delete',disabled:true}]" @select="selected=$event.label">Actions</Menu><Text>Selected: {{ selected }}</Text></main>`,
  }),
};
