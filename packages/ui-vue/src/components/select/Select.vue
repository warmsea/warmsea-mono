<script setup lang="ts">
import { computed, nextTick, ref, useAttrs } from 'vue';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: readonly SelectOption[];
  modelValue: string | null;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
}

defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<SelectProps>(), {
  placeholder: 'Select an option',
  disabled: false,
  required: false,
  name: undefined,
});
const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();
const attrs = useAttrs();
const control = ref<HTMLSelectElement>();
const nativeValue = computed(() =>
  props.options.some((option) => option.value === props.modelValue)
    ? props.modelValue!
    : '',
);
const managedAttrs = new Set(['multiple', 'size', 'value', 'role']);

function nativeAttrs() {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => !managedAttrs.has(key)),
  );
}

function change(event: Event) {
  const select = event.currentTarget as HTMLSelectElement;
  const option = props.options.find((item) => item.value === select.value);
  if (
    !select.matches(':disabled') &&
    option?.value &&
    !option.disabled &&
    option.value !== props.modelValue
  ) {
    emit('update:modelValue', option.value);
  }
  void nextTick(() => {
    if (control.value) control.value.value = nativeValue.value;
  });
}
</script>

<template>
  <select
    ref="control"
    v-bind="nativeAttrs()"
    class="wui-select"
    :value="nativeValue"
    :disabled="disabled"
    :required="required"
    :name="name"
    @change="change"
  >
    <option value="" disabled :selected="nativeValue === ''">
      {{ placeholder }}
    </option>
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
      :selected="option.value === nativeValue"
    >
      {{ option.label }}
    </option>
  </select>
</template>

<style>
.wui-select {
  box-sizing: border-box;
  appearance: none;
  inline-size: 16rem;
  max-inline-size: 100%;
  min-inline-size: 0;
  padding: var(--wui-control-padding-block) var(--wui-space-3);
  padding-inline-end: calc(var(--wui-space-3) * 2 + 0.75em);
  border: var(--wui-border-width) solid var(--wui-color-border);
  border-radius: var(--wui-radius-control);
  color: var(--wui-color-text);
  background-color: var(--wui-color-surface);
  background-image:
    linear-gradient(
      45deg,
      transparent 40%,
      currentColor 40% 60%,
      transparent 60%
    ),
    linear-gradient(
      135deg,
      transparent 40%,
      currentColor 40% 60%,
      transparent 60%
    );
  background-position:
    right calc(var(--wui-space-3) + 0.375em) center,
    right var(--wui-space-3) center;
  background-size: 0.375em 0.375em;
  background-repeat: no-repeat;
  font-family: var(--wui-font-family);
  font-size: var(--wui-font-size-control);
  font-weight: var(--wui-font-weight-regular);
  line-height: var(--wui-line-height-control);
}

.wui-select:dir(rtl) {
  background-position:
    left var(--wui-space-3) center,
    left calc(var(--wui-space-3) + 0.375em) center;
}

.wui-select:hover:enabled {
  border-color: var(--wui-color-primary);
}

.wui-select:focus-visible {
  outline: var(--wui-focus-width) solid var(--wui-color-focus);
  outline-offset: var(--wui-focus-offset);
}

.wui-select:disabled {
  color: var(--wui-color-disabled-text);
  background-color: var(--wui-color-disabled-surface);
  border-color: transparent;
  cursor: not-allowed;
}

@media (forced-colors: active) {
  .wui-select {
    appearance: auto;
    padding-inline-end: var(--wui-space-3);
    border-color: ButtonText;
    background-image: none;
  }

  .wui-select:disabled {
    color: GrayText;
    border-color: GrayText;
  }
}
</style>
