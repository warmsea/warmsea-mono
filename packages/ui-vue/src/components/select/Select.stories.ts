import { ref } from 'vue';
import { useArgs } from 'storybook/preview-api';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Button from '../button/Button.vue';
import Heading from '../heading/Heading.vue';
import Text from '../text/Text.vue';
import Select from './Select.vue';

const options = [
  { value: 'ocean', label: 'Ocean' },
  { value: 'reef', label: 'Reef', disabled: true },
  { value: 'coast', label: 'Coast' },
];
const meta = {
  title: 'Components/Select',
  id: 'warmsea-select',
  component: Select,
  parameters: { layout: 'padded' },
  argTypes: {
    options: { control: 'object' },
    modelValue: {
      control: 'text',
      description: 'Selected option value, or null for the prompt.',
    },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    name: { control: 'text' },
  },
  args: {
    options,
    modelValue: null,
    placeholder: 'Select an option',
    disabled: false,
    required: false,
  },
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { Select, Heading, Text },
      setup: () => ({
        args,
        update: (value: string | null) => updateArgs({ modelValue: value }),
      }),
      template: `
        <main class="wui-story wui-story-select">
          <Heading :level="1">Select playground</Heading>
          <Text>Choose one option using the browser's native picker. Use Controls to change the configuration.</Text>
          <div class="wui-story-select__field">
            <label for="select-playground">Destination</label>
            <Select id="select-playground" v-bind="args" aria-describedby="select-playground-help" @update:model-value="update" />
            <Text id="select-playground-help">Reef is unavailable. The prompt is not a selectable option.</Text>
          </div>
          <Text>Selected value: <output>{{ args.modelValue ?? 'None' }}</output></Text>
        </main>
      `,
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
    components: { Select, Button, Heading, Text },
    setup: () => {
      const submitted = ref('Not submitted');
      return {
        options,
        selected: ref<string | null>(null),
        submitted,
        scoped: ref<string | null>('coast'),
        rtl: ref<string | null>('ocean'),
        long: ref<string | null>('long'),
        layoutSelection: ref<string | null>('ocean'),
        layoutApplied: ref('Not applied'),
        longOptions: [
          {
            value: 'long',
            label:
              'Internationalcollaborationworkspace and a long destination label',
          },
        ],
        submit: (event: Event) => {
          const data = new FormData(event.currentTarget as HTMLFormElement);
          submitted.value = String(data.get('destination') ?? 'None');
        },
      };
    },
    template: `
      <main class="wui-story wui-story-select wui-story-demos">
        <Heading :level="1">Select demos</Heading>
        <Text>Fixed native selection examples using the browser's own picker.</Text>
        <section aria-label="Selection and forms">
          <Heading :level="2">Selection and forms</Heading>
          <Text>Choose a destination before submitting. Reset clears the parent model, restoring the prompt.</Text>
          <form class="wui-story-select__form" @submit.prevent="submit" @reset.prevent="selected = null">
            <div class="wui-story-select__field">
              <label for="select-demo-destination">Destination</label>
              <Select id="select-demo-destination" v-model="selected" :options="options" name="destination" required aria-describedby="select-demo-help" />
              <Text id="select-demo-help">Required. Reef is unavailable.</Text>
            </div>
            <div class="wui-story-row">
              <Button type="submit">Submit destination</Button>
              <Button type="reset" variant="outlined">Reset destination</Button>
            </div>
            <Text>Last submitted: <output>{{ submitted }}</output></Text>
          </form>
        </section>
        <section aria-label="Selection states">
          <Heading :level="2">Selection states</Heading>
          <div class="wui-story-select__grid">
            <div class="wui-story-select__field">
              <label for="select-demo-disabled">Unavailable destination</label>
              <Select id="select-demo-disabled" :model-value="'ocean'" :options="options" disabled />
              <Text>Disabled controls keep their selected label.</Text>
            </div>
            <div class="wui-story-select__field">
              <label for="select-demo-empty">Empty list</label>
              <Select id="select-demo-empty" :model-value="null" :options="[]" placeholder="No destinations available" />
              <Text>No option is selected automatically.</Text>
            </div>
          </div>
        </section>
        <section aria-label="Layout and direction">
          <Heading :level="2">Layout and direction</Heading>
          <div class="wui-story-select__grid">
            <div class="wui-story-select__field wui-story-select__scope">
              <label for="select-demo-scoped">Scoped destination</label>
              <Select id="select-demo-scoped" v-model="scoped" :options="options" />
              <Text>The closed control inherits local text and surface tokens.</Text>
            </div>
            <div class="wui-story-select__field">
              <label for="select-demo-rtl">RTL destination</label>
              <Select id="select-demo-rtl" v-model="rtl" :options="options" dir="rtl" />
            </div>
            <div class="wui-story-select__field">
              <label for="select-demo-long">Long destination</label>
              <Select id="select-demo-long" v-model="long" :options="longOptions" />
              <Text>The control fits its container; the browser manages the picker.</Text>
            </div>
          </div>
        </section>
        <section aria-label="Control layout">
          <Heading :level="2">Control layout</Heading>
          <Text>Body text stays 16px. Button and Select share 14px text, a 20px line and 5px padding above and below, plus borders.</Text>
          <div class="wui-story-select__controls">
            <div class="wui-story-select__field">
              <label for="select-demo-layout">Fixed choice</label>
              <Select id="select-demo-layout" v-model="layoutSelection" :options="options" />
            </div>
            <Button @click="layoutApplied = layoutSelection ?? 'None'">Apply choice</Button>
          </div>
          <Text role="status" aria-label="Applied choices">{{ layoutApplied }}</Text>
        </section>
      </main>
    `,
  }),
};
