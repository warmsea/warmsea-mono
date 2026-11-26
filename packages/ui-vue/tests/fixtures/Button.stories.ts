import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { Button } from '../../src';
import './contract.css';

export default {
  title: 'Contracts/Button',
  id: 'wui-contract-button',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export const MatrixAndPalette: StoryObj = {
  render: () => ({
    components: { Button },
    setup() {
      const variants = ['primary', 'default', 'outlined', 'subtle'] as const;
      const clicks = ref(0);
      const palette = ref('ocean');
      const foreground = ref('#ffffff');

      return { variants, clicks, palette, foreground };
    },
    template: `<main class="wui-contract"><h1>Button contracts</h1>
    <section aria-labelledby="matrix-title">
      <h2 id="matrix-title">Button collection</h2>
      <p>Four variants. One text size and consistent interaction contract.</p>
      <div id="matrix" class="matrix">
        <div v-for="variant in variants" :key="variant" class="row">
          <span class="row-label">{{ variant }}</span>
          <Button :variant="variant">Set sail</Button>
          <Button :variant="variant" disabled>Unavailable</Button>
        </div>
      </div>
    </section>

    <section aria-labelledby="interaction-title">
      <h2 id="interaction-title">Native interactions</h2>
      <div class="row">
        <Button data-testid="counter" @click="clicks++"
          >Explore the coast</Button
        >
        <Button data-testid="disabled" disabled @click="clicks++"
          >Disabled</Button
        >
        <output data-testid="click-count" aria-live="polite"
          >Activations: {{ clicks }}</output
        >
      </div>
      <p id="help">
        Tab to the enabled button, then activate it with Enter or Space.
      </p>
      <label for="destination">Destination</label>
      <input id="destination" name="destination" value="Warmsea" />
    </section>

    <section aria-labelledby="brand-title">
      <h2 id="brand-title">Bring your own palette</h2>
      <p>
        Replace the complete primary and container state group. Changing only
        primary does not derive local hover or active colors. Choose a readable
        foreground for every state.
      </p>
      <div class="row">
        <label for="palette">Palette</label>
        <select id="palette" v-model="palette">
          <option value="ocean">Ocean</option>
          <option value="blue">Blue</option>
        </select>
        <label for="foreground">Foreground</label>
        <input id="foreground" v-model="foreground" type="color" />
      </div>
      <div
        class="brand-preview row"
        :class="{ 'blue-brand': palette === 'blue' }"
        :style="{
          '--wui-color-on-primary': foreground,
        }"
      >
        <Button data-testid="brand-button">Your coastline</Button>
        <Button variant="default" data-testid="brand-default"
          >Default coastline</Button
        >
        <Button variant="outlined">Outlined stays neutral</Button>
      </div>
      <div class="nested-brand row">
        <Button data-testid="custom-button">A different shore</Button>
        <Button variant="default" data-testid="custom-default"
          >A softer shore</Button
        >
        <Button variant="outlined" data-testid="custom-outlined"
          >Still neutral</Button
        >
        <Button data-testid="custom-disabled" disabled>Still disabled</Button>
        <Button variant="default" data-testid="default-disabled" disabled
          >Default disabled</Button
        >
        <div class="light-brand">
          <Button data-testid="light-button">Sun on the water</Button>
          <Button variant="default" data-testid="light-default"
            >Default sunlight</Button
          >
        </div>
      </div>
    </section>

    </main>`,
  }),
};
