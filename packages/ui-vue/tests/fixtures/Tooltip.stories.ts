import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { Tooltip, Button, type TooltipPlacement } from '../../src';
import './contract.css';
export default {
  title: 'Contracts/Tooltip',
  id: 'wui-contract-tooltip',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export const Positioning: StoryObj = {
  render: () => ({
    components: { Tooltip, Button },
    setup() {
      const tooltipText = ref('Download the current results as CSV');
      const tooltipPlacements: TooltipPlacement[] = [
        'top',
        'bottom',
        'inline-start',
        'inline-end',
      ];
      const tooltipSubmits = ref(0);
      const tooltipTriggerKey = ref(0);

      return {
        tooltipText,
        tooltipPlacements,
        tooltipSubmits,
        tooltipTriggerKey,
      };
    },
    template: `<main class="wui-contract"><h1>Tooltip contracts</h1>
    <section id="tooltip-examples" aria-labelledby="tooltip-title">
      <h2 id="tooltip-title">Tooltips</h2>
      <p>
        Hover or keyboard-focus a control. Escape dismisses its supplementary
        hint.
      </p>
      <label for="tooltip-copy">Tooltip text</label>
      <input id="tooltip-copy" v-model="tooltipText" />
      <div class="row tooltip-placements">
        <Tooltip
          v-for="placement in tooltipPlacements"
          :key="placement"
          :text="tooltipText"
          :placement="placement"
          :data-testid="\`tooltip-\${placement}\`"
          @replace-trigger="tooltipTriggerKey++"
        >
          <template #default="{ describedBy }">
            <Button :key="tooltipTriggerKey" variant="default" :aria-describedby="describedBy"
              >Tooltip {{ placement }}</Button
            >
          </template>
        </Tooltip>
      </div>
      <div class="tooltip-clip" data-testid="tooltip-clip">
        <div class="tooltip-clip-content">
          <Tooltip
            text="Escapes the scroll container"
            placement="inline-end"
            data-testid="tooltip-clipped"
          >
            <template #default="{ describedBy }">
              <Button :aria-describedby="describedBy">Details</Button>
            </template>
          </Tooltip>
        </div>
      </div>
      <form @submit.prevent="tooltipSubmits++">
        <Tooltip text="Send the current report" data-testid="tooltip-submit">
          <template #default="{ describedBy }">
            <Button type="submit" :aria-describedby="describedBy"
              >Submit report</Button
            >
          </template>
        </Tooltip>
        <p>
          Tooltip submits:
          <span data-testid="tooltip-submits">{{ tooltipSubmits }}</span>
        </p>
      </form>
    </section>

    </main>`,
  }),
};
