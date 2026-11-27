<script setup lang="ts">
import { computed, nextTick, ref, useAttrs, useId } from 'vue';

export interface TextareaProps {
  modelValue: string;
  id?: string;
  label?: string;
  helpText?: string;
  errorText?: string;
  invalid?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  appearance?: 'default' | 'embedded';
}
defineOptions({ inheritAttrs: false });
const props = defineProps<TextareaProps>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const attrs = useAttrs();
const generatedId = `wui-textarea-${useId()}`;
const control = ref<HTMLTextAreaElement>();
const id = computed(() => props.id ?? generatedId);
const descriptionId = computed(() => `${id.value}-description`);
const invalid = computed(() => props.invalid || Boolean(props.errorText));
const composing = ref(false);
let compositionValue: string | undefined;
const managed = new Set([
  'class',
  'style',
  'value',
  'role',
  'aria-invalid',
  'aria-describedby',
]);
function nativeAttrs() {
  return Object.fromEntries(
    Object.entries(attrs).filter(([name]) => !managed.has(name)),
  );
}
function describedBy() {
  const ids = String(attrs['aria-describedby'] ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (props.errorText || props.helpText) ids.push(descriptionId.value);
  return [...new Set(ids)].join(' ') || undefined;
}
function update(value: string) {
  if (
    control.value &&
    !control.value.matches(':disabled') &&
    !props.readonly &&
    value !== props.modelValue
  )
    emit('update:modelValue', value);
  restore();
}
function restore() {
  void nextTick(() => {
    if (control.value && !composing.value)
      control.value.value = props.modelValue;
  });
}
function input(event: Event) {
  if (composing.value || (event as InputEvent).isComposing) return;
  const value = (event.target as HTMLTextAreaElement).value;
  if (compositionValue !== value) update(value);
  else restore();
  compositionValue = undefined;
}
function compositionEnd(event: CompositionEvent) {
  if (!composing.value) return;
  composing.value = false;
  compositionValue = (event.target as HTMLTextAreaElement).value;
  update(compositionValue);
}
defineExpose({ focus: () => control.value?.focus() });
</script>

<template>
  <div
    class="wui-textarea"
    :class="[
      attrs.class,
      { 'wui-textarea--embedded': appearance === 'embedded' },
    ]"
    :style="attrs.style"
    :dir="attrs.dir == null ? undefined : String(attrs.dir)"
  >
    <label v-if="label" :for="id" class="wui-textarea__label">{{
      label
    }}</label>
    <textarea
      :id="id"
      ref="control"
      rows="3"
      v-bind="nativeAttrs()"
      class="wui-textarea__native"
      :value="composing ? control?.value : modelValue"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="invalid ? 'true' : undefined"
      :aria-describedby="describedBy()"
      @input="input"
      @beforeinput="compositionValue = undefined"
      @compositionstart="composing = true"
      @compositionend="compositionEnd"
    />
    <span
      v-if="errorText || helpText"
      :id="descriptionId"
      class="wui-textarea__description"
      :class="{ 'wui-textarea__description--error': errorText }"
      >{{ errorText || helpText }}</span
    >
  </div>
</template>

<style>
.wui-textarea {
  display: inline-flex;
  flex-direction: column;
  gap: var(--wui-space-1);
  inline-size: 24rem;
  max-inline-size: 100%;
  min-inline-size: 0;
  font-family: var(--wui-font-family);
  font-size: var(--wui-font-size);
  font-weight: var(--wui-font-weight-regular);
  line-height: var(--wui-line-height);
  color: var(--wui-color-text);
  vertical-align: top;
}
.wui-textarea__native {
  box-sizing: border-box;
  inline-size: 100%;
  min-inline-size: 0;
  padding: var(--wui-control-padding-block) var(--wui-space-3);
  border: var(--wui-border-width) solid var(--wui-color-border);
  border-radius: var(--wui-radius-control);
  background: var(--wui-color-surface);
  color: inherit;
  font-family: inherit;
  font-size: var(--wui-font-size-control);
  line-height: var(--wui-line-height-control);
  resize: vertical;
}
.wui-textarea__native::placeholder {
  color: var(--wui-color-disabled-text);
  opacity: 1;
}
.wui-textarea__native:hover:not(:disabled),
.wui-textarea__native:focus {
  border-color: var(--wui-color-primary);
}
.wui-textarea__native[aria-invalid='true'] {
  border-color: var(--wui-color-error);
}
.wui-textarea__native:focus-visible {
  outline: var(--wui-focus-width) solid var(--wui-color-focus);
  outline-offset: var(--wui-focus-offset);
}
.wui-textarea__native:disabled {
  border-color: transparent;
  color: var(--wui-color-disabled-text);
  background: var(--wui-color-disabled-surface);
  cursor: not-allowed;
}
.wui-textarea--embedded .wui-textarea__native {
  border-color: transparent;
  background: transparent;
}
.wui-textarea--embedded .wui-textarea__native[aria-invalid='true'] {
  border-color: var(--wui-color-error);
}
.wui-textarea__label,
.wui-textarea__description {
  overflow-wrap: anywhere;
}
.wui-textarea__description--error {
  color: var(--wui-color-error);
}
@media (forced-colors: active) {
  .wui-textarea__native,
  .wui-textarea__native[aria-invalid='true'],
  .wui-textarea--embedded .wui-textarea__native,
  .wui-textarea--embedded .wui-textarea__native[aria-invalid='true'] {
    border-color: CanvasText;
  }
  .wui-textarea__native:disabled,
  .wui-textarea--embedded .wui-textarea__native:disabled {
    border-color: GrayText;
    color: GrayText;
  }
}
</style>
