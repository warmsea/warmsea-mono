import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { tokenValue } from '../../../docs/token-reference';
import AppBar, { type AppBarItem, type AppBarProps } from './AppBar.vue';

type AppBarArgs = AppBarProps & { primaryColor: string };
const items: readonly AppBarItem[] = [
  { id: 'activity', label: 'Activity', href: '#appbar-demo-activity' },
  {
    id: 'chat',
    label: 'Chat',
    href: '#appbar-demo-chat',
  },
  { id: 'calendar', label: 'Calendar', href: '#appbar-demo-calendar' },
];
const bottomItems = [
  { id: 'settings', label: 'Settings', href: '#appbar-demo-settings' },
];
const icon = `
  <template #icon="{ item, active }">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="active ? 2 : 1.75" focusable="false">
      <path v-if="item.id === 'chat'" d="M4 4h16v12H9l-5 4V4Z" />
      <path v-else-if="item.id === 'calendar'" d="M4 5h16v15H4V5Zm0 5h16M8 2v6m8-6v6" />
      <path v-else-if="item.id === 'settings'" d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Zm3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      <path v-else d="M6 10a6 6 0 0 1 12 0v5l2 2H4l2-2v-5Zm3 10h6" />
    </svg>
  </template>
`;

const meta = {
  title: 'Components/AppBar',
  id: 'warmsea-app-bar',
  component: AppBar,
  parameters: { layout: 'padded' },
  argTypes: {
    items: {
      control: 'object',
      description:
        'Ordered icon destinations with unique IDs, accessible labels, and hrefs.',
    },
    bottomItems: {
      control: 'object',
      description:
        'Optional bottom destinations; IDs are unique across both groups.',
    },
    activeId: {
      control: 'select',
      options: ['', 'activity', 'chat', 'calendar', 'settings'],
      description:
        'Application-owned current destination. No automatic selection.',
    },
    primaryColor: {
      control: 'color',
      description: 'Playground-only --wui-color-primary override.',
    },
  },
  args: {
    items,
    bottomItems,
    activeId: 'activity',
    primaryColor: tokenValue('--wui-color-primary'),
  },
} satisfies Meta<AppBarArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { AppBar },
    setup() {
      const destinations = computed(() => [
        ...args.items,
        ...(args.bottomItems ?? []),
      ]);
      const selected = ref(args.activeId);
      watch(
        () => args.activeId,
        (value) => {
          selected.value = value;
        },
      );
      function syncLocation() {
        const destination = [...args.items, ...(args.bottomItems ?? [])].find(
          (item) => item.href === window.location.hash,
        );
        if (destination) selected.value = destination.id;
      }
      onMounted(() => {
        syncLocation();
        window.addEventListener('hashchange', syncLocation);
      });
      onUnmounted(() => window.removeEventListener('hashchange', syncLocation));
      return { args, selected, destinations };
    },
    template: `
      <main class="wui-story">
        <h1>AppBar playground</h1>
        <p>Change destinations, current item, or local primary color in Controls. Hover an icon for its label. This example owns fragment navigation and selection.</p>
        <div class="wui-story-app-shell" :style="{ '--wui-color-primary': args.primaryColor }">
          <AppBar aria-label="Primary apps" :items="args.items" :bottom-items="args.bottomItems" :active-id="selected">
            ${icon}
          </AppBar>
          <div class="wui-story-app-content" role="region" aria-label="App content" tabindex="0">
            <div v-for="item in destinations" :key="item.id" :id="item.href.slice(1)">
              <h2>{{ item.label }}</h2>
              <p>{{ item.label }} destination</p>
            </div>
          </div>
        </div>
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
    components: { AppBar },
    setup() {
      const overflowItems = Array.from({ length: 8 }, (_, index) => ({
        id: `extra-${index}`,
        label: `App ${index + 1}`,
        href: `#appbar-demo-extra-${index}`,
      }));
      const selected = ref({
        base: 'activity',
        overflow: '',
      });
      function selectDemo(
        group: keyof typeof selected.value,
        item: AppBarItem,
        event: MouseEvent,
      ) {
        event.preventDefault();
        selected.value[group] = item.id;
      }
      return {
        items,
        bottomItems,
        overflowItems,
        selected,
        selectDemo,
      };
    },
    template: `
      <main class="wui-story wui-story-demos">
        <h1>AppBar demos</h1>
        <p>Select a destination to preview its active state in place. Hover an icon for its label. Each example keeps its own selection; use Playground for Controls and native navigation.</p>
        <section aria-label="Base rail">
          <h2>Base rail</h2>
          <div class="wui-story-app-shell wui-story-app-height">
            <AppBar aria-label="Base apps" :items="items" :bottom-items="bottomItems" :active-id="selected.base" @activate="(item, event) => selectDemo('base', item, event)">${icon}</AppBar>
          </div>
        </section>
        <section aria-label="Short height">
          <h2>Short height</h2>
          <p>Scroll or focus later links to reach every destination, including Settings.</p>
          <div class="wui-story-app-shell wui-story-app-short">
            <AppBar aria-label="Overflow apps" :items="overflowItems" :bottom-items="bottomItems" :active-id="selected.overflow" @activate="(item, event) => selectDemo('overflow', item, event)">${icon}</AppBar>
          </div>
        </section>
      </main>
    `,
  }),
};
