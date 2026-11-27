<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useAttrs,
  useId,
  watch,
} from 'vue';
import Button from '../button/Button.vue';

export type InputType =
  'text' | 'password' | 'email' | 'search' | 'tel' | 'url';

export interface InputProps {
  modelValue: string;
  type?: InputType;
  id?: string;
  label?: string;
  helpText?: string;
  errorText?: string;
  invalid?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  name?: string;
  placeholder?: string;
  clearable?: boolean;
  clearLabel?: string;
}

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<InputProps>(), {
  type: 'text',
  id: undefined,
  label: undefined,
  helpText: undefined,
  errorText: undefined,
  name: undefined,
  placeholder: undefined,
  invalid: false,
  disabled: false,
  readonly: false,
  required: false,
  clearable: false,
  clearLabel: 'Clear input',
});
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const attrs = useAttrs();
const generatedId = `wui-input-${useId()}`;
const control = ref<HTMLInputElement>();
const nativeDisabled = ref(false);
let composing = false;
let compositionValue: string | undefined;
let observer: MutationObserver | undefined;
const inputId = computed(() => props.id ?? generatedId);
const descriptionId = computed(() => `${inputId.value}-description`);
const isInvalid = computed(() => props.invalid || Boolean(props.errorText));
const disabled = computed(() => props.disabled || nativeDisabled.value);
const managedAttrs = new Set([
  'class',
  'style',
  'value',
  'role',
  'aria-invalid',
  'aria-describedby',
]);

function nativeAttrs() {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => !managedAttrs.has(key)),
  );
}

function describedBy() {
  const ids = String(attrs['aria-describedby'] ?? '')
    .split(/\s+/)
    .filter(Boolean);
  if (props.errorText || props.helpText) ids.push(descriptionId.value);
  return [...new Set(ids)].join(' ') || undefined;
}

function restore() {
  void nextTick(() => {
    if (
      control.value &&
      !composing &&
      control.value.value !== props.modelValue
    ) {
      control.value.value = props.modelValue;
    }
  });
}

function update(value: string) {
  if (
    control.value &&
    !control.value.matches(':disabled') &&
    !props.readonly &&
    value !== props.modelValue
  ) {
    emit('update:modelValue', value);
  }
  restore();
}

function input(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (composing || (event as InputEvent).isComposing) return;
  if (compositionValue === value) {
    compositionValue = undefined;
    restore();
    return;
  }
  compositionValue = undefined;
  update(value);
}

function compositionEnd(event: CompositionEvent) {
  if (!composing) return;
  composing = false;
  compositionValue = (event.target as HTMLInputElement).value;
  update(compositionValue);
}

function clear() {
  update('');
  control.value?.focus();
}

function refreshDisabled() {
  nativeDisabled.value = control.value?.matches(':disabled') ?? false;
}

watch(() => props.disabled, refreshDisabled, { flush: 'post' });
onMounted(() => {
  refreshDisabled();
  observer = new MutationObserver(refreshDisabled);
  for (
    let parent = control.value?.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    if (parent.tagName === 'FIELDSET') {
      observer.observe(parent, {
        attributes: true,
        attributeFilter: ['disabled'],
      });
    }
  }
});
onUnmounted(() => observer?.disconnect());
</script>

<template>
  <div
    class="wui-input"
    :class="attrs.class"
    :style="attrs.style"
    :dir="attrs.dir == null ? undefined : String(attrs.dir)"
  >
    <label v-if="label" class="wui-input__label" :for="inputId">{{
      label
    }}</label>
    <div
      class="wui-input__control"
      :class="{ 'wui-input__control--invalid': isInvalid }"
    >
      <input
        :id="inputId"
        ref="control"
        v-bind="nativeAttrs()"
        class="wui-input__native"
        :class="{ 'wui-input__native--clearable': clearable }"
        :type="type"
        :value="composing ? control?.value : modelValue"
        :disabled="props.disabled"
        :readonly="readonly"
        :required="required"
        :name="name"
        :placeholder="placeholder"
        :aria-invalid="isInvalid ? 'true' : undefined"
        :aria-describedby="describedBy()"
        @input="input"
        @beforeinput="compositionValue = undefined"
        @compositionstart="composing = true"
        @compositionend="compositionEnd"
      />
      <Button
        v-if="clearable && modelValue && !readonly && !disabled"
        class="wui-input__action"
        variant="subtle"
        :aria-label="clearLabel"
        @click="clear"
        ><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="m6 6 12 12M6 18 18 6" /></svg
      ></Button>
    </div>
    <span
      v-if="errorText || helpText"
      :id="descriptionId"
      class="wui-input__description"
      :class="{ 'wui-input__description--error': errorText }"
      >{{ errorText || helpText }}</span
    >
  </div>
</template>

<style>
.wui-input {
  display: inline-flex;
  flex-direction: column;
  gap: var(--wui-space-1);
  inline-size: 16rem;
  max-inline-size: 100%;
  min-inline-size: 0;
  font-family: var(--wui-font-family);
  font-size: var(--wui-font-size);
  font-weight: var(--wui-font-weight-regular);
  line-height: var(--wui-line-height);
  color: var(--wui-color-text);
  vertical-align: top;
}

.wui-input__label,
.wui-input__description {
  overflow-wrap: anywhere;
}

.wui-input__control {
  display: flex;
  align-items: center;
  gap: var(--wui-space-1);
  min-inline-size: 0;
  padding-inline: var(--wui-space-3);
  border: var(--wui-border-width) solid var(--wui-color-border);
  border-radius: var(--wui-radius-control);
  background: var(--wui-color-surface);
  color: var(--wui-color-text);
  font-size: var(--wui-font-size-control);
  line-height: var(--wui-line-height-control);
}

.wui-input__native {
  box-sizing: border-box;
  flex: 1;
  inline-size: 0;
  min-inline-size: 0;
  padding: var(--wui-control-padding-block) 0;
  border: 0;
  border-radius: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
}

.wui-input__native::placeholder {
  color: var(--wui-color-disabled-text);
  opacity: 1;
}

.wui-input__native--clearable::-webkit-search-cancel-button {
  appearance: none;
}

.wui-input__control:hover:not(:where(:has(.wui-input__native:disabled))),
.wui-input__control:focus-within {
  border-color: var(--wui-color-primary);
}

.wui-input__control.wui-input__control--invalid,
.wui-input__control.wui-input__control--invalid:hover,
.wui-input__control.wui-input__control--invalid:focus-within {
  border-color: var(--wui-color-error);
}

.wui-input__control:has(.wui-input__native:focus-visible) {
  outline: var(--wui-focus-width) solid var(--wui-color-focus);
  outline-offset: var(--wui-focus-offset);
}

.wui-input__action {
  flex: none;
  padding: 0;
  border: 0;
  border-radius: var(--wui-space-1);
  min-inline-size: 1.5em;
  min-block-size: 1.5em;
}

.wui-input__action svg {
  inline-size: 1em;
  block-size: 1em;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.wui-input__description--error {
  color: var(--wui-color-error);
}

.wui-input__control:has(.wui-input__native:disabled) {
  color: var(--wui-color-disabled-text);
  background: var(--wui-color-disabled-surface);
  border-color: transparent;
  cursor: not-allowed;
}

.wui-input__native:disabled {
  cursor: not-allowed;
}

@media (forced-colors: active) {
  .wui-input__control,
  .wui-input__control.wui-input__control--invalid,
  .wui-input__control.wui-input__control--invalid:hover,
  .wui-input__control.wui-input__control--invalid:focus-within {
    border-color: CanvasText;
  }

  .wui-input__control:has(.wui-input__native:disabled) {
    color: GrayText;
    border-color: GrayText;
  }
}
</style>
