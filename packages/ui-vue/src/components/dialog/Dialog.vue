<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  useId,
  watch,
} from 'vue';
import Heading from '../heading/Heading.vue';

export interface DialogProps {
  modelValue: boolean;
  title: string;
}
defineOptions({ inheritAttrs: false });
const props = defineProps<DialogProps>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();
const attrs = useAttrs();
const heading = `wui-dialog-${useId()}`;
const dialog = ref<HTMLDialogElement>();
let returnFocus: HTMLElement | undefined;
let pointerTarget: HTMLElement | undefined;
let pointerAt = 0;
let disposed = false;
function nativeAttrs() {
  return Object.fromEntries(
    Object.entries(attrs).filter(
      ([key]) => !['open', 'role', 'aria-labelledby'].includes(key),
    ),
  );
}
function remember(event: PointerEvent) {
  if (props.modelValue || !(event.target instanceof Element)) return;
  const target = event.target.closest<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]',
  );
  if (!target || target.matches(':disabled')) return;
  pointerTarget = target;
  pointerAt = performance.now();
}
function restore() {
  if (returnFocus?.isConnected) returnFocus.focus();
  returnFocus = undefined;
}
function sync() {
  const element = dialog.value;
  if (!element?.isConnected || disposed) return;
  if (props.modelValue && !element.open) {
    const active = document.activeElement;
    returnFocus =
      active instanceof HTMLElement && active !== document.body
        ? active
        : performance.now() - pointerAt < 1000
          ? pointerTarget
          : undefined;
    element.showModal();
  } else if (!props.modelValue && element.open) element.close();
}
function closed() {
  // Native close events are queued and can arrive after the modal reopens.
  if (disposed || dialog.value?.open) return;
  if (props.modelValue) emit('update:modelValue', false);
  void nextTick(() => {
    if (props.modelValue) sync();
    else restore();
  });
}
watch(() => props.modelValue, sync, { flush: 'post' });
onMounted(() => {
  document.addEventListener('pointerdown', remember, true);
  sync();
});
onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener('pointerdown', remember, true);
  if (dialog.value?.open) dialog.value.close();
  restore();
});
</script>

<template>
  <dialog
    ref="dialog"
    v-bind="nativeAttrs()"
    class="wui-dialog"
    :aria-labelledby="heading"
    @cancel.prevent="emit('update:modelValue', false)"
    @close="closed"
  >
    <Heading :id="heading" :level="2">{{ title }}</Heading>
    <div class="wui-dialog__body"><slot /></div>
    <footer v-if="$slots.footer" class="wui-dialog__footer">
      <slot name="footer" />
    </footer>
  </dialog>
</template>

<style>
.wui-dialog {
  box-sizing: border-box;
  inline-size: min(36rem, calc(100% - var(--wui-space-5)));
  max-inline-size: calc(100% - var(--wui-space-5));
  max-block-size: calc(100% - var(--wui-space-5));
  padding: var(--wui-space-5);
  border: var(--wui-border-width) solid var(--wui-color-border);
  border-radius: var(--wui-radius-control);
  background: var(--wui-color-surface);
  color: var(--wui-color-text);
  font-family: var(--wui-font-family);
  font-size: var(--wui-font-size);
  line-height: var(--wui-line-height);
  overflow: auto;
  overflow-wrap: anywhere;
}
.wui-dialog::backdrop {
  background: color-mix(in srgb, var(--wui-color-text) 35%, transparent);
}
.wui-dialog__body {
  margin-block-start: var(--wui-space-4);
}
.wui-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--wui-space-2);
  margin-block-start: var(--wui-space-5);
}
@media (forced-colors: active) {
  .wui-dialog {
    border-color: CanvasText;
  }
}
</style>
