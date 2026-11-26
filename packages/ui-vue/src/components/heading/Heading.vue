<script setup lang="ts">
export interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

defineProps<HeadingProps>();
</script>

<template>
  <component
    :is="`h${level}`"
    class="wui-heading"
    :class="`wui-heading--${level}`"
  >
    <slot />
  </component>
</template>

<style>
.wui-heading {
  margin: 0;
  color: var(--wui-color-text);
  font-family: var(--wui-font-family);
  font-weight: var(--wui-font-weight-semibold);
  line-height: var(--wui-line-height-heading);
}

.wui-heading--1 {
  font-size: var(--wui-font-size-heading-1);
}

.wui-heading--2 {
  font-size: var(--wui-font-size-heading-2);
}

.wui-heading--3 {
  font-size: var(--wui-font-size-heading-3);
}

.wui-heading--4 {
  font-size: var(--wui-font-size-heading-4);
}

.wui-heading--5 {
  font-size: var(--wui-font-size-heading-5);
}

.wui-heading--6 {
  font-size: var(--wui-font-size-heading-6);
}
</style>
