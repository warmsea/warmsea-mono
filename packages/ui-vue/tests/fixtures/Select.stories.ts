import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { Select, Button, Heading, Text, type SelectOption } from '../../src';
import './contract.css';
export default {
  title: 'Contracts/Select',
  id: 'wui-contract-select',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export const Forms: StoryObj = {
  render: () => ({
    components: { Select, Button, Heading, Text },
    setup() {
      const selectValue = ref<string | null>('ocean');
      const selectDisabled = ref(false);
      const selectFieldsetDisabled = ref(false);
      const selectSubmitted = ref('Not submitted');
      const selectAssociated = ref<string | null>(null);
      const selectOptions = ref<SelectOption[]>([
        { value: 'ocean', label: 'Ocean' },
        { value: 'reef', label: 'Reef', disabled: true },
        { value: 'coast', label: 'Coast' },
      ]);
      function submitSelect(event: Event) {
        selectSubmitted.value = String(
          new FormData(event.currentTarget as HTMLFormElement).get(
            'destination',
          ) ?? 'None',
        );
      }

      return {
        selectValue,
        selectDisabled,
        selectFieldsetDisabled,
        selectSubmitted,
        selectAssociated,
        selectOptions,
        submitSelect,
      };
    },
    template: `<main class="wui-contract"><h1>Select contracts</h1>
    <section
      class="select-fixtures"
      aria-labelledby="select-title"
      data-testid="select-fixtures"
    >
      <Heading id="select-title" :level="2">Native selection</Heading>
      <form
        data-testid="select-form"
        @submit.prevent="submitSelect"
        @reset.prevent="selectValue = 'ocean'"
      >
        <fieldset :disabled="selectFieldsetDisabled">
          <label for="native-destination">Native destination</label>
          <Select
            id="native-destination"
            v-model="selectValue"
            :options="selectOptions"
            :disabled="selectDisabled"
            name="destination"
            required
            aria-describedby="select-help"
          />
        </fieldset>
        <Text id="select-help"
          >Choose an available destination. Reef is unavailable.</Text
        >
        <div class="row">
          <Button type="submit">Submit native selection</Button>
          <Button type="reset" variant="outlined"
            >Reset native selection</Button
          >
        </div>
        <output data-testid="select-value">{{ selectValue ?? 'None' }}</output>
        <output data-testid="select-submitted">{{ selectSubmitted }}</output>
      </form>
      <div class="row">
        <Button variant="outlined" @click="selectValue = null"
          >Clear native selection</Button
        >
        <Button variant="outlined" @click="selectValue = 'coast'"
          >Choose native coast</Button
        >
        <Button variant="outlined" @click="selectValue = 'missing'"
          >Choose unknown native value</Button
        >
        <Button variant="outlined" @click="selectValue = 'reef'"
          >Choose disabled native value</Button
        >
        <Button variant="outlined" @click="selectDisabled = !selectDisabled"
          >Toggle native disabled</Button
        >
        <Button
          variant="outlined"
          @click="selectFieldsetDisabled = !selectFieldsetDisabled"
          >Toggle native fieldset</Button
        >
        <Button
          variant="outlined"
          @click="
            selectOptions = selectOptions.filter(
              (option) => option.value !== 'coast',
            )
          "
          >Remove native coast</Button
        >
        <Button
          variant="outlined"
          @click="
            selectOptions = [
              ...selectOptions.filter((option) => option.value !== 'coast'),
              { value: 'coast', label: 'Coast' },
            ]
          "
          >Restore native coast</Button
        >
      </div>
      <div class="row" data-testid="select-states">
        <div>
          <label for="native-disabled">Disabled native destination</label>
          <Select
            id="native-disabled"
            :model-value="'coast'"
            :options="selectOptions"
            disabled
          />
        </div>
        <div>
          <label for="native-empty">Empty native destination</label>
          <Select id="native-empty" :model-value="null" :options="[]" />
        </div>
        <div
          :style="{
            '--wui-color-primary': '#9f1239',
            '--wui-color-text': '#7c2d12',
            '--wui-color-surface': '#fff7ed',
          }"
        >
          <label for="native-scoped">Scoped native destination</label>
          <Select
            id="native-scoped"
            :model-value="'ocean'"
            :options="selectOptions"
          />
        </div>
        <div dir="rtl">
          <label for="native-rtl">RTL native destination</label>
          <Select
            id="native-rtl"
            :model-value="'coast'"
            :options="selectOptions"
          />
        </div>
        <div style="max-inline-size: 10rem">
          <label for="native-long">Long native destination</label>
          <Select
            id="native-long"
            :model-value="'long'"
            :options="[
              {
                value: 'long',
                label:
                  'Internationalcollaborationworkspace and a long destination label',
              },
            ]"
          />
        </div>
      </div>
      <label for="native-associated">Associated native destination</label>
      <Select
        id="native-associated"
        v-model="selectAssociated"
        :options="selectOptions"
        form="select-external-form"
        name="destination"
      />
      <form id="select-external-form" aria-label="External native form">
        <Text>The associated select is outside this form.</Text>
      </form>
    </section>

    </main>`,
  }),
};
