import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { Button, Select, Text, Heading, type SelectOption } from '../../src';
import './contract.css';
export default {
  title: 'Contracts/Controls',
  id: 'wui-contract-controls',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export const Layout: StoryObj = {
  render: () => ({
    components: { Button, Select, Text, Heading },
    setup() {
      const layoutSelection = ref<string | null>('ocean');
      const selectOptions = ref<SelectOption[]>([
        { value: 'ocean', label: 'Ocean' },
        { value: 'reef', label: 'Reef', disabled: true },
        { value: 'coast', label: 'Coast' },
      ]);

      return { layoutSelection, selectOptions };
    },
    template: `<main class="wui-contract"><h1>Controls contracts</h1>
<Text data-testid="text-default">A quiet place to begin.</Text><Button data-testid="counter">Outside control scope</Button>
    <section
      aria-labelledby="control-layout-title"
      data-testid="control-layout-fixtures"
    >
      <Heading id="control-layout-title" :level="2">Control layout</Heading>
      <Text
        >16px body text, 14px controls, 20px lines and 5px control
        padding.</Text
      >
      <div class="control-layout-row" data-testid="control-layout-row">
        <div class="control-layout-field">
          <label for="control-layout-select">Fixed choice</label>
          <Select
            id="control-layout-select"
            v-model="layoutSelection"
            :options="selectOptions"
          />
        </div>
        <Button data-testid="control-layout-button">Apply choices</Button>
      </div>
      <div
        class="control-layout-row control-layout-scoped"
        data-testid="control-layout-scoped"
      >
        <Button data-testid="control-layout-scoped-button"
          >Larger scoped button</Button
        >
        <Select
          v-model="layoutSelection"
          :options="selectOptions"
          aria-label="Larger scoped select"
        />
      </div>
      <div
        class="control-layout-row control-layout-enlarged"
        data-testid="control-layout-enlarged"
      >
        <Button data-testid="control-layout-enlarged-button"
          >Enlarged button</Button
        >
        <Select
          v-model="layoutSelection"
          :options="selectOptions"
          aria-label="Enlarged select"
        />
      </div>
      <div class="control-layout-row">
        <Button style="inline-size: 8rem" data-testid="control-layout-wrapped"
          >A longer button label that wraps</Button
        >
        <Button data-testid="control-layout-icon" aria-label="Icon action">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 10h12M10 4v12" fill="none" stroke="currentColor" />
          </svg>
        </Button>
      </div>
      <div
        dir="rtl"
        class="control-layout-row"
        data-testid="control-layout-rtl"
      >
        <Button>RTL action</Button>
        <Select
          v-model="layoutSelection"
          :options="selectOptions"
          aria-label="RTL fixed choice"
        />
      </div>
    </section>

    </main>`,
  }),
};
