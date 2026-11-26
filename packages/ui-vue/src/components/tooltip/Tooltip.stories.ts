import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Button from '../button/Button.vue';
import Tooltip, {
  type TooltipProps,
  type TooltipPlacement,
} from './Tooltip.vue';

type TooltipArgs = TooltipProps & { triggerLabel: string };

const meta = {
  title: 'Components/Tooltip',
  id: 'warmsea-tooltip',
  component: Tooltip,
  parameters: { layout: 'padded' },
  argTypes: {
    text: {
      control: 'text',
      description: 'Brief plain-text help. Empty text disables the hint.',
    },
    placement: {
      control: 'select',
      options: ['top', 'bottom', 'inline-start', 'inline-end'],
      description: 'Preferred side; collision handling can choose another.',
    },
    describe: {
      control: 'boolean',
      description: 'Supply a describedBy ID to bind on the trigger.',
    },
    triggerLabel: {
      control: 'text',
      description: 'Playground-only trigger content, not a Tooltip prop.',
    },
  },
  args: {
    text: 'Download the current results as CSV',
    placement: 'top',
    describe: true,
    triggerLabel: 'Export',
  },
} satisfies Meta<TooltipArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => ({
    components: { Tooltip, Button },
    setup: () => ({ args }),
    template: `
      <main class="wui-story">
        <h1>Tooltip playground</h1>
        <p>Hover or keyboard-focus the button. Escape dismisses the hint; there is no opening delay, animation, or click toggle.</p>
        <Tooltip :text="args.text" :placement="args.placement" :describe="args.describe" data-testid="tooltip-playground">
          <template #default="{ describedBy }">
            <Button :aria-describedby="describedBy">{{ args.triggerLabel }}</Button>
          </template>
        </Tooltip>
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
    components: { Tooltip, Button },
    setup: () => ({
      placements: [
        'top',
        'bottom',
        'inline-start',
        'inline-end',
      ] satisfies TooltipPlacement[],
    }),
    template: `
      <main class="wui-story wui-story-demos">
        <h1>Tooltip demos</h1>
        <p>Use real hover or keyboard focus to compare hints. Nothing opens or receives focus automatically.</p>
        <section aria-label="Placements">
          <h2>Placements</h2>
          <div class="wui-story-row">
            <Tooltip v-for="placement in placements" :key="placement" :text="'Preferred ' + placement + ' placement'" :placement="placement">
              <template #default="{ describedBy }">
                <Button variant="default" :aria-describedby="describedBy">{{ placement.charAt(0).toUpperCase() + placement.slice(1) }}</Button>
              </template>
            </Tooltip>
          </div>
        </section>
        <section aria-label="Description and existing label">
          <h2>Description and existing label</h2>
          <div class="wui-story-row">
            <Tooltip text="Download the current results as CSV">
              <template #default="{ describedBy }">
                <Button variant="default" :aria-describedby="describedBy">Export</Button>
              </template>
            </Tooltip>
            <Tooltip text="Settings" :describe="false">
              <Button variant="default">Settings</Button>
            </Tooltip>
          </div>
          <p>Settings already names its control, so its visual hint does not repeat that name as a description.</p>
        </section>
        <section aria-label="Long text">
          <h2>Long text</h2>
          <Tooltip text="Internationalcollaborationworkspace settings and preferences wrap instead of being truncated">
            <template #default="{ describedBy }">
              <Button variant="default" :aria-describedby="describedBy">Workspace help</Button>
            </template>
          </Tooltip>
        </section>
        <section aria-label="Scrollable clipping container">
          <h2>Scrollable clipping container</h2>
          <div class="wui-story-tooltip-clip">
            <div class="wui-story-tooltip-scroll-content">
              <Tooltip text="This hint escapes its scroll container" placement="inline-end">
                <template #default="{ describedBy }">
                  <Button variant="default" :aria-describedby="describedBy">Details</Button>
                </template>
              </Tooltip>
            </div>
          </div>
        </section>
        <section aria-label="Viewport edge and RTL">
          <h2>Viewport edge and RTL</h2>
          <p>Inline-end flips when the viewport is too narrow. In RTL it prefers the physical left side.</p>
          <div class="wui-story-tooltip-edge">
            <Tooltip text="This hint chooses another side near the viewport edge" placement="inline-end">
              <template #default="{ describedBy }">
                <Button variant="default" :aria-describedby="describedBy">Near inline end</Button>
              </template>
            </Tooltip>
          </div>
          <div dir="rtl">
            <Tooltip text="Logical inline-end in RTL" placement="inline-end">
              <template #default="{ describedBy }">
                <Button variant="default" :aria-describedby="describedBy">RTL help</Button>
              </template>
            </Tooltip>
          </div>
        </section>
      </main>
    `,
  }),
};
