import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { ref } from 'vue';
import { Button, Heading, Textarea, Dialog } from '../../src';
import './contract.css';
export default {
  title: 'Contracts/Shared',
  id: 'wui-contract-shared',
  tags: ['!dev', '!autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export const FormsAndModal: StoryObj = {
  render: () => ({
    components: { Button, Heading, Textarea, Dialog },
    setup() {
      const dialogOpen = ref(false);
      const notes = ref('');
      const notesSubmitted = ref('');

      return { dialogOpen, notes, notesSubmitted };
    },
    template: `<main class="wui-contract"><h1>Shared contracts</h1>
    <section
      id="shared-interactions"
      aria-labelledby="shared-interactions-title"
    >
      <Heading id="shared-interactions-title" :level="2"
        >Dialog and multiline fields</Heading
      >
      <form
        @submit.prevent="notesSubmitted = notes"
        @reset.prevent="notes = ''"
      >
        <Textarea
          v-model="notes"
          label="Multiline notes"
          name="notes"
          required
          help-text="Enter destination notes."
        />
        <Button type="submit">Submit notes</Button>
        <Button type="reset">Reset notes</Button>
        <output data-testid="notes-submitted">{{ notesSubmitted }}</output>
      </form>
      <div class="embedded-field-surface">
        <Textarea
          v-model="notes"
          appearance="embedded"
          aria-label="Embedded notes"
          help-text="Notes inside a shared surface."
        />
        <Textarea
          model-value="Stored"
          appearance="embedded"
          label="Embedded disabled notes"
          disabled
        />
        <Textarea
          model-value=""
          appearance="embedded"
          label="Embedded invalid notes"
          error-text="Enter notes."
        />
      </div>
      <Button @click="dialogOpen = true">Open shared dialog</Button>
      <Dialog v-model="dialogOpen" title="Review notes">
        <Textarea v-model="notes" label="Dialog notes" />
        <template #footer
          ><Button variant="default" @click="dialogOpen = false"
            >Close shared dialog</Button
          ></template
        >
      </Dialog>
    </section>

    </main>`,
  }),
};
