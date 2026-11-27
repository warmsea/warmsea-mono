import { ref } from 'vue';
import { useArgs } from 'storybook/preview-api';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Input from './Input.vue';
import Button from '../button/Button.vue';
import Heading from '../heading/Heading.vue';
import Text from '../text/Text.vue';

const meta = {
  title: 'Components/Input',
  id: 'warmsea-input',
  component: Input,
  parameters: { layout: 'padded' },
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'password', 'email', 'search', 'tel', 'url'],
    },
    modelValue: { control: 'text' },
  },
  args: {
    modelValue: '',
    type: 'text',
    label: 'Destination',
    helpText: 'Enter a destination.',
    clearable: false,
    disabled: false,
    readonly: false,
    required: false,
    invalid: false,
  },
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FormExample: Story = {
  tags: ['!dev'],
  render: () => ({
    components: { Input, Button, Text },
    setup() {
      const value = ref('');
      const submitted = ref('Not submitted');
      return {
        value,
        submitted,
        submit: (event: Event) => {
          submitted.value = String(
            new FormData(event.currentTarget as HTMLFormElement).get(
              'destination',
            ),
          );
        },
      };
    },
    template: `<form class="wui-story" @submit.prevent="submit" @reset.prevent="value = ''">
      <Input v-model="value" label="Destination" name="destination" required clearable help-text="Required. Reset clears the parent model." />
      <div class="wui-story-row"><Button type="submit">Submit destination</Button><Button type="reset" variant="outlined">Reset destination</Button></div>
      <Text>Last submitted: <output>{{ submitted }}</output></Text>
    </form>`,
  }),
};

export const Playground: Story = {
  render: (args) => {
    const [, updateArgs] = useArgs();
    return {
      components: { Input, Heading, Text },
      setup: () => ({
        args,
        update: (value: string) => updateArgs({ modelValue: value }),
      }),
      template: `<main class="wui-story"><Heading :level="1">Input playground</Heading>
        <Input v-bind="args" @update:model-value="update" />
        <Text>Current value: <output>{{ args.modelValue }}</output></Text></main>`,
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
    components: { Input, Button, Heading, Text },
    setup() {
      const destination = ref('');
      const submitted = ref('Not submitted');
      return {
        destination,
        submitted,
        password: ref('Sea breeze'),
        search: ref('Ocean'),
        email: ref(''),
        telephone: ref(''),
        website: ref(''),
        account: ref('warmsea'),
        submit: (event: Event) => {
          submitted.value = String(
            new FormData(event.currentTarget as HTMLFormElement).get(
              'destination',
            ),
          );
        },
      };
    },
    template: `<main class="wui-story wui-story-demos">
      <Heading :level="1">Input demos</Heading>
      <section aria-label="Native form">
        <Heading :level="2">Native form</Heading>
        <form @submit.prevent="submit" @reset.prevent="destination = ''">
          <Input v-model="destination" label="Destination" name="destination" required clearable help-text="Required. Reset is parent-owned." />
          <div class="wui-story-row"><Button type="submit">Submit destination</Button><Button type="reset" variant="outlined">Reset destination</Button></div>
          <Text>Last submitted: <output>{{ submitted }}</output></Text>
        </form>
      </section>
      <section aria-label="Input types">
        <Heading :level="2">Input types</Heading>
        <div class="wui-story-input-grid">
          <Input v-model="password" type="password" label="Password" clearable autocomplete="new-password" />
          <Input v-model="email" type="email" label="Email" placeholder="you@example.com" />
          <Input v-model="search" type="search" label="Search" clearable />
          <Input v-model="telephone" type="tel" label="Telephone" />
          <Input v-model="website" type="url" label="Website" />
        </div>
      </section>
      <section aria-label="Input states">
        <Heading :level="2">Input states</Heading>
        <div class="wui-story-input-grid">
          <Input model-value="Unknown" label="Invalid destination" help-text="Choose carefully." error-text="This destination is unavailable." />
          <Input model-value="Ocean" label="Readonly destination" readonly clearable />
          <Input model-value="Ocean" label="Disabled destination" disabled clearable />
        </div>
      </section>
      <section aria-label="Layout and direction">
        <Heading :level="2">Layout and direction</Heading>
        <div class="wui-story-input-grid">
          <Input v-model="account" label="RTL account" dir="rtl" />
          <Input v-model="account" label="Scoped account" invalid style="--wui-color-error: #9f1239" />
        </div>
      </section>
    </main>`,
  }),
};
