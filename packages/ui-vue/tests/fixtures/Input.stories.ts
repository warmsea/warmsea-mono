import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { Input, Button } from '../../src';
import './contract.css';
export default {
  title: 'Contracts/Input',
  id: 'wui-contract-input',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export const Forms: StoryObj = {
  render: () => ({
    components: { Input, Button },
    setup() {
      const inputValue = ref('');
      const inputPassword = ref('Sea breeze');
      const inputFieldsetDisabled = ref(false);
      const inputSubmitted = ref('Not submitted');
      const inputAssociated = ref('');
      function submitInput(event: Event) {
        inputSubmitted.value = String(
          new FormData(event.currentTarget as HTMLFormElement).get(
            'inputDestination',
          ),
        );
      }

      return {
        inputValue,
        inputPassword,
        inputFieldsetDisabled,
        inputSubmitted,
        inputAssociated,
        submitInput,
      };
    },
    template: `<main class="wui-contract"><h1>Input contracts</h1>
    <section id="input-examples" aria-labelledby="input-title">
      <h2 id="input-title">Input examples</h2>
      <form
        id="input-form"
        @submit.prevent="submitInput"
        @reset.prevent="inputValue = ''"
      >
        <Input
          v-model="inputValue"
          label="Input destination"
          name="inputDestination"
          required
          clearable
          help-text="Enter a destination."
        />
        <Button type="submit">Submit input</Button>
        <Button type="reset">Reset input</Button>
        <output data-testid="input-submitted">{{ inputSubmitted }}</output>
      </form>
      <div class="row">
        <Input
          v-model="inputPassword"
          label="Input password"
          type="password"
          clearable
          autocomplete="new-password"
        />
        <Input model-value="Ocean" label="Input readonly" readonly clearable />
        <Input
          model-value="Wrong"
          label="Input invalid"
          error-text="Choose another destination."
        />
        <Input
          v-model="inputAssociated"
          label="Associated input"
          form="input-form"
          name="associatedInput"
        />
      </div>
      <Button @click="inputFieldsetDisabled = !inputFieldsetDisabled"
        >Toggle input fieldset</Button
      >
      <fieldset :disabled="inputFieldsetDisabled">
        <legend>Input fieldset</legend>
        <Input
          v-model="inputPassword"
          label="Fieldset password"
          type="password"
          clearable
        />
      </fieldset>
    </section>

    </main>`,
  }),
};
