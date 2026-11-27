<script setup lang="ts">
export interface ButtonProps {
  variant?: 'primary' | 'default' | 'outlined' | 'subtle';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  disabled: false,
  type: 'button',
});
</script>

<template>
  <button
    class="wui-button"
    :class="`wui-button--${variant}`"
    :disabled="disabled"
    :type="type"
  >
    <slot />
  </button>
</template>

<style>
.wui-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--wui-space-2);
  margin: 0;
  padding: var(--wui-control-padding-block) var(--wui-space-3);
  border: var(--wui-border-width) solid transparent;
  border-radius: var(--wui-radius-control);
  font-family: var(--wui-font-family);
  font-size: var(--wui-font-size-control);
  font-weight: var(--wui-font-weight);
  line-height: var(--wui-line-height-control);
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}

.wui-button--primary {
  color: var(--wui-color-on-primary);
  background-color: var(--wui-color-primary);
}

.wui-button--primary:hover:enabled {
  background-color: var(--wui-color-primary-hover);
}

.wui-button--primary:active:enabled {
  background-color: var(--wui-color-primary-active);
}

.wui-button--default {
  color: var(--wui-color-text);
  background-color: var(--wui-color-primary-container);
}

.wui-button--default:hover:enabled {
  background-color: var(--wui-color-primary-container-hover);
}

.wui-button--default:active:enabled {
  background-color: var(--wui-color-primary-container-active);
}

.wui-button--outlined {
  color: var(--wui-color-text);
  background-color: var(--wui-color-surface);
  border-color: var(--wui-color-border);
}

.wui-button--outlined:hover:enabled {
  background-color: var(--wui-color-surface-subtle);
}

.wui-button--outlined:active:enabled {
  background-color: var(--wui-color-surface-subtle-active);
}

.wui-button--subtle {
  color: var(--wui-color-text);
  background-color: transparent;
}

.wui-button--subtle:hover:enabled {
  background-color: var(--wui-color-subtle-hover);
}

.wui-button--subtle:active:enabled {
  background-color: var(--wui-color-subtle-active);
}

.wui-button:focus-visible {
  outline: var(--wui-focus-width) solid var(--wui-color-focus);
  outline-offset: var(--wui-focus-offset);
}

.wui-button:disabled {
  color: var(--wui-color-disabled-text);
  background-color: var(--wui-color-disabled-surface);
  border-color: transparent;
  cursor: not-allowed;
}

@media (forced-colors: active) {
  .wui-button {
    border-color: ButtonText;
  }

  .wui-button:disabled {
    color: GrayText;
    border-color: GrayText;
  }
}
</style>
