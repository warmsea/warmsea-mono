<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  useId,
  watch,
} from 'vue';
import { Button, Text, Textarea } from '@warmsea/ui-vue';

export interface ChatInputProps {
  modelValue: string;
  label: string;
  submitLabel: string;
  canSubmit: boolean;
  disabled?: boolean;
  readonly?: boolean;
  placeholder?: string;
  helpText?: string;
  errorText?: string;
  keyboardHint?: string;
}
export interface ChatInputSlotState {
  disabled: boolean;
  canSubmit: boolean;
  isComposing: boolean;
}
defineOptions({ inheritAttrs: false });
const props = defineProps<ChatInputProps>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
  submit: [value: string];
  reset: [event: Event];
}>();
defineSlots<{
  attachments(props: ChatInputSlotState): unknown;
  'actions-start'(props: ChatInputSlotState): unknown;
  'actions-end'(props: ChatInputSlotState): unknown;
  'submit-content'(props: ChatInputSlotState): unknown;
}>();
const attrs = useAttrs();
const surface = ref<HTMLFormElement>();
const field = ref<InstanceType<typeof Textarea>>();
const composing = ref(false);
const fieldsetDisabled = ref(false);
const id = `wui-chat-input-${useId()}`;
const unavailable = computed(
  () => !!props.disabled || !!props.readonly || fieldsetDisabled.value,
);
const ready = computed(
  () => props.canSubmit && !unavailable.value && !composing.value,
);
const slotState = computed<ChatInputSlotState>(() => ({
  disabled: unavailable.value,
  canSubmit: ready.value,
  isComposing: composing.value,
}));
const managed = new Set(['class', 'style', 'aria-describedby', 'aria-label']);
function nativeAttrs() {
  return Object.fromEntries(
    Object.entries(attrs).filter(
      ([key]) => !managed.has(key) && key.toLowerCase() !== 'form',
    ),
  );
}
function describedBy() {
  const ids = String(attrs['aria-describedby'] ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (props.keyboardHint) ids.push(`${id}-hint`);
  if (props.errorText) ids.push(`${id}-error`);
  return [...new Set(ids)].join(' ') || undefined;
}
function control() {
  return field.value?.$el?.querySelector('textarea') as
    HTMLTextAreaElement | undefined;
}
function refreshFieldset() {
  const input = control();
  fieldsetDisabled.value =
    !!input && input.matches(':disabled') && !input.disabled;
}
watch(() => props.disabled, refreshFieldset, { flush: 'post' });
function reset(event: Event) {
  if (event.target !== surface.value) return;
  event.preventDefault();
  emit('reset', event);
}
function submit() {
  refreshFieldset();
  if (
    !ready.value ||
    control()?.matches(':disabled') ||
    !surface.value?.reportValidity()
  )
    return;
  emit('submit', props.modelValue);
}
function keydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.key !== 'Enter' ||
    event.shiftKey ||
    composing.value ||
    event.isComposing ||
    event.keyCode === 229
  )
    return;
  event.preventDefault();
  submit();
}
function resize() {
  const input = control();
  if (!input) return;
  input.style.height = 'auto';
  const style = getComputedStyle(input);
  input.style.height = `${input.scrollHeight + parseFloat(style.borderTopWidth || '0') + parseFloat(style.borderBottomWidth || '0')}px`;
}
let pendingResize = false;
let disposed = false;
function scheduleResize() {
  if (pendingResize || disposed) return;
  pendingResize = true;
  void nextTick(async () => {
    await nextTick();
    pendingResize = false;
    if (!disposed) resize();
  });
}
watch(() => props.modelValue, scheduleResize, { flush: 'post' });
let dimensions: ResizeObserver | undefined;
let ancestors: MutationObserver | undefined;
let observedAncestors: HTMLElement[] = [];
function observeAncestors() {
  const current: HTMLElement[] = [];
  for (
    let element: HTMLElement | null = surface.value ?? null;
    element;
    element = element.parentElement
  )
    current.push(element);
  if (
    current.length === observedAncestors.length &&
    current.every((element, index) => element === observedAncestors[index])
  )
    return;
  ancestors?.disconnect();
  observedAncestors = current;
  for (const element of current)
    ancestors?.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'style', 'disabled'],
      childList: true,
    });
}
onMounted(() => {
  refreshFieldset();
  resize();
  if (typeof ResizeObserver !== 'undefined' && surface.value) {
    let width = -1;
    dimensions = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width !== width) {
        width = entry.contentRect.width;
        scheduleResize();
      }
    });
    dimensions.observe(surface.value);
  }
  if (typeof MutationObserver !== 'undefined') {
    ancestors = new MutationObserver(() => {
      observeAncestors();
      refreshFieldset();
      scheduleResize();
    });
    observeAncestors();
  }
  document.fonts?.addEventListener('loadingdone', scheduleResize);
});
onBeforeUnmount(() => {
  disposed = true;
  dimensions?.disconnect();
  ancestors?.disconnect();
  observedAncestors = [];
  document.fonts?.removeEventListener('loadingdone', scheduleResize);
});
defineExpose({ focus: () => field.value?.focus() });
</script>

<template>
  <form
    ref="surface"
    class="wui-chat-input"
    :class="attrs.class"
    :style="attrs.style"
    :dir="attrs.dir == null ? undefined : String(attrs.dir)"
    @submit.prevent="submit"
    @reset="reset"
  >
    <slot name="attachments" v-bind="slotState" />
    <Textarea
      ref="field"
      v-bind="nativeAttrs()"
      class="wui-chat-input__field"
      appearance="embedded"
      :model-value="modelValue"
      :aria-label="label"
      :aria-describedby="describedBy()"
      :help-text="errorText ? undefined : helpText"
      :invalid="Boolean(errorText)"
      :placeholder="placeholder"
      :rows="attrs.rows ?? 2"
      :disabled="disabled"
      :readonly="readonly"
      @update:model-value="emit('update:modelValue', $event)"
      @input="scheduleResize"
      @compositionstart="composing = true"
      @compositionend="
        composing = false;
        scheduleResize();
      "
      @keydown="keydown"
    />
    <Text
      v-if="errorText"
      :id="`${id}-error`"
      role="alert"
      class="wui-chat-input__error"
      >{{ errorText }}</Text
    >
    <div class="wui-chat-input__actions">
      <slot name="actions-start" v-bind="slotState" />
      <div class="wui-chat-input__extra-actions">
        <slot name="actions-end" v-bind="slotState" />
      </div>
      <Button
        type="submit"
        class="wui-chat-input__submit"
        :aria-label="submitLabel"
        :disabled="!ready"
      >
        <slot name="submit-content" v-bind="slotState">{{ submitLabel }}</slot>
      </Button>
    </div>
    <span
      v-if="keyboardHint"
      :id="`${id}-hint`"
      class="wui-chat-input__sr-only"
      >{{ keyboardHint }}</span
    >
  </form>
</template>

<style>
.wui-chat-input {
  display: flex;
  flex-direction: column;
  gap: var(--wui-space-2);
  min-inline-size: 0;
  padding: var(--wui-space-2);
  border: var(--wui-border-width) solid var(--wui-color-border);
  border-radius: calc(var(--wui-radius-control) * 2.5);
  background: var(--wui-color-surface);
}
.wui-chat-input__field {
  inline-size: 100%;
  --wui-font-size-control: var(--wui-font-size);
  --wui-line-height-control: var(--wui-line-height);
}
.wui-chat-input__field textarea {
  resize: none;
  min-block-size: 3.5rem;
  max-block-size: var(--wui-chat-input-max-block-size, 10rem);
  overflow: auto;
}
.wui-chat-input__actions,
.wui-chat-input__extra-actions {
  display: flex;
  gap: var(--wui-space-2);
  align-items: center;
  min-inline-size: 0;
}
.wui-chat-input__extra-actions {
  flex: 1;
  justify-content: flex-end;
}
.wui-chat-input__actions button {
  min-inline-size: 2.75rem;
  min-block-size: 2.75rem;
}
.wui-chat-input__error {
  color: var(--wui-color-error);
  overflow-wrap: anywhere;
}
.wui-chat-input__sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
</style>
