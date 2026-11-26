<script setup lang="ts">
export interface TextProps {
  as?: 'p' | 'span';
  weight?: 'regular' | 'semibold';
}

withDefaults(defineProps<TextProps>(), {
  as: 'p',
  weight: 'regular',
});
</script>

<template>
  <component :is="as" class="wui-text" :class="`wui-text--${weight}`">
    <slot />
  </component>
</template>

<style>
.wui-text {
  margin: 0;
  color: var(--wui-color-text);
  font-family: var(--wui-font-family);
  font-size: var(--wui-font-size);
  line-height: var(--wui-line-height);
}

.wui-text--regular {
  font-weight: var(--wui-font-weight-regular);
}

.wui-text--semibold {
  font-weight: var(--wui-font-weight-semibold);
}
</style>
