<script setup lang="ts">
import { ref } from 'vue';
import { Button, Heading, Text } from '@warmsea/ui-vue';
import { ChatInput } from '@warmsea/ui-ai';
const draft = ref('');
const submitted = ref<string[]>([]);
const disabled = ref(false);
const readonly = ref(false);
const attachment = ref(false);
const fieldsetDisabled = ref(false);
const enlarged = ref(false);
const error = ref('');
const rejectEdits = ref(false);
function update(value: string) {
  if (!rejectEdits.value) draft.value = value;
}
</script>
<template>
  <main
    class="prompt-demo"
    :style="
      enlarged ? { '--wui-font-size': '2rem', '--wui-line-height': '1.5' } : {}
    "
  >
    <Heading :level="1">Prompt composer</Heading>
    <div class="prompt-demo__controls">
      <Button variant="outlined" @click="disabled = !disabled"
        >Toggle disabled</Button
      >
      <Button variant="outlined" @click="readonly = !readonly"
        >Toggle readonly</Button
      >
      <Button variant="outlined" @click="fieldsetDisabled = !fieldsetDisabled"
        >Toggle fieldset</Button
      >
      <Button variant="outlined" @click="attachment = !attachment"
        >Toggle attachment</Button
      >
      <Button
        variant="outlined"
        @click="
          draft = Array.from({ length: 30 }, (_, i) => `Draft line ${i}`).join(
            '\n',
          )
        "
        >Long draft</Button
      >
      <Button variant="outlined" @click="draft = 'Short draft'"
        >Short draft</Button
      >
      <Button variant="outlined" @click="enlarged = !enlarged"
        >Toggle font</Button
      >
      <Button variant="outlined" @click="rejectEdits = !rejectEdits"
        >Toggle rejected edits</Button
      >
      <Button
        variant="outlined"
        @click="error = error ? '' : 'Attachment is too large.'"
        >Toggle error</Button
      >
    </div>
    <fieldset :disabled="fieldsetDisabled" class="prompt-demo__fieldset">
      <legend>Local-only prompt</legend>
      <ChatInput
        :model-value="draft"
        label="Message"
        submit-label="Send"
        :disabled="disabled"
        :readonly="readonly"
        :can-submit="Boolean(draft.trim()) || attachment"
        :error-text="error"
        help-text="Your draft is controlled by this demo."
        keyboard-hint="Enter to send. Shift+Enter for a new line."
        @submit="submitted.push($event)"
        @update:model-value="update"
      >
        <template #attachments="{ disabled: locked }">
          <Button
            v-if="attachment"
            variant="subtle"
            :disabled="locked"
            @click="attachment = false"
            >Remove local attachment</Button
          >
        </template>
      </ChatInput>
    </fieldset>
    <Text role="status">Submitted {{ submitted.length }} times</Text>
    <pre data-testid="submitted">{{ submitted.at(-1) }}</pre>
  </main>
</template>
<style>
.prompt-demo {
  display: grid;
  gap: var(--wui-space-3);
  max-inline-size: 48rem;
  padding: var(--wui-space-3);
}
.prompt-demo__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--wui-space-2);
}
.prompt-demo__fieldset {
  min-inline-size: 0;
  border: 0;
  padding: 0;
  margin: 0;
}
.prompt-demo pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
