<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import Button from '../button/Button.vue';

export interface MenuItem {
  id: string;
  label: string;
  disabled?: boolean;
}
export interface MenuProps {
  label: string;
  items: MenuItem[];
  disabled?: boolean;
}
const props = defineProps<MenuProps>();
const emit = defineEmits<{ select: [item: MenuItem] }>();
const id = `wui-menu-${useId()}`;
const root = ref<HTMLElement>();
const menu = ref<HTMLElement>();
const opened = ref(false);
const supported = ref(false);
let invoker: HTMLElement | undefined;
let observer: ResizeObserver | undefined;
let focusedId: string | undefined;
let generation = 0;
let frame: number | undefined;
function buttons() {
  return Array.from(
    menu.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ??
      [],
  );
}
function setStyle(element: HTMLElement, property: string, value: string) {
  if (element.style.getPropertyValue(property) !== value)
    element.style.setProperty(property, value);
}
function position() {
  const surface = menu.value;
  if (!opened.value || !surface || !invoker) return;
  const trigger = invoker.getBoundingClientRect();
  const triggerStyle = window.getComputedStyle(invoker);
  if (
    !invoker.isConnected ||
    invoker.matches(':disabled') ||
    !trigger.width ||
    !trigger.height ||
    triggerStyle.visibility === 'hidden' ||
    triggerStyle.visibility === 'collapse'
  ) {
    close(false);
    return;
  }
  const viewport = window.visualViewport;
  const x = viewport?.offsetLeft ?? 0;
  const y = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? document.documentElement.clientWidth;
  const height = viewport?.height ?? document.documentElement.clientHeight;
  setStyle(surface, 'max-width', `${Math.max(0, width - 16)}px`);
  setStyle(surface, 'max-height', `${Math.max(0, height - 16)}px`);
  const box = surface.getBoundingClientRect();
  const rtl = triggerStyle.direction === 'rtl';
  const left = Math.max(
    x + 8,
    Math.min(
      rtl ? trigger.left : trigger.right - box.width,
      x + width - box.width - 8,
    ),
  );
  const preferredTop =
    trigger.bottom + box.height + 8 <= y + height
      ? trigger.bottom + 4
      : trigger.top - box.height - 4;
  const top = Math.max(
    y + 8,
    Math.min(preferredTop, y + height - box.height - 8),
  );
  setStyle(surface, 'left', `${left}px`);
  setStyle(surface, 'top', `${top}px`);
}
function track(current: number) {
  if (current !== generation || !opened.value) return;
  frame = undefined;
  position();
  if (current === generation && opened.value)
    frame = window.requestAnimationFrame(() => track(current));
}
function close(focus = true) {
  generation++;
  if (frame !== undefined) window.cancelAnimationFrame(frame);
  frame = undefined;
  if (!opened.value) return;
  opened.value = false;
  observer?.disconnect();
  observer = undefined;
  document.removeEventListener('pointerdown', outside, true);
  document.removeEventListener('focusin', outside);
  window.removeEventListener('resize', position);
  window.removeEventListener('scroll', position, true);
  window.visualViewport?.removeEventListener('resize', position);
  window.visualViewport?.removeEventListener('scroll', position);
  menu.value?.hidePopover?.();
  if (focus && invoker?.isConnected && !invoker.matches(':disabled'))
    invoker.focus();
}
async function open(event: Event, last = false) {
  if (
    props.disabled ||
    (event.currentTarget as HTMLElement).matches(':disabled')
  )
    return;
  invoker = event.currentTarget as HTMLElement;
  if (opened.value) return;
  const current = ++generation;
  opened.value = true;
  await nextTick();
  if (current !== generation || !opened.value || !menu.value?.isConnected)
    return;
  menu.value?.showPopover?.();
  position();
  if (current !== generation || !opened.value) return;
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('focusin', outside);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      if (current === generation) position();
    });
    observer.observe(invoker);
    observer.observe(menu.value);
  }
  const targets = buttons();
  ((last ? targets.at(-1) : targets[0]) ?? menu.value)?.focus();
  if (current === generation && opened.value)
    frame = window.requestAnimationFrame(() => track(current));
}
function toggle(event: MouseEvent) {
  if (opened.value) close();
  else void open(event);
}
function keydown(event: KeyboardEvent) {
  const targets = buttons();
  const index = targets.indexOf(document.activeElement as HTMLButtonElement);
  const key = event.key;
  if (key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    close();
  } else if (key === 'Tab') close();
  else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
    event.preventDefault();
    const next =
      key === 'Home'
        ? 0
        : key === 'End'
          ? targets.length - 1
          : (index + (key === 'ArrowDown' ? 1 : -1) + targets.length) %
            targets.length;
    targets[next]?.focus();
  } else if (
    key.length === 1 &&
    key !== ' ' &&
    !event.isComposing &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  ) {
    const ordered = [
      ...targets.slice(index + 1),
      ...targets.slice(0, index + 1),
    ];
    const match = ordered.find((button) =>
      button.textContent?.trim().toLowerCase().startsWith(key.toLowerCase()),
    );
    if (match) {
      event.preventDefault();
      match.focus();
    }
  }
}
function outside(event: Event) {
  if (opened.value && !root.value?.contains(event.target as Node)) close(false);
}
function toggled(event: Event) {
  if (
    (event as Event & { newState: string }).newState === 'closed' &&
    !menu.value?.matches(':popover-open')
  )
    close(false);
}
function selected(item: MenuItem) {
  if (!opened.value || props.disabled || item.disabled) return;
  close();
  emit('select', item);
}
watch(
  () => [props.disabled, props.items],
  () => {
    if (!opened.value) return;
    if (props.disabled) {
      close(false);
      return;
    }
    const current = props.items.find((item) => item.id === focusedId);
    if (!current || current.disabled) (buttons()[0] ?? menu.value)?.focus();
    position();
  },
  { deep: true, flush: 'post' },
);
onMounted(() => {
  supported.value = typeof menu.value?.showPopover === 'function';
});
onBeforeUnmount(() => {
  close(false);
});
</script>

<template>
  <span ref="root" class="wui-menu">
    <Button
      variant="subtle"
      :disabled="disabled"
      :aria-label="label"
      aria-haspopup="menu"
      :aria-expanded="opened"
      :aria-controls="id"
      @click="toggle"
      @keydown.down.prevent="open($event)"
      @keydown.up.prevent="open($event, true)"
      ><slot>{{ label }}</slot></Button
    >
    <div
      v-show="opened"
      :id="id"
      ref="menu"
      class="wui-menu__popup"
      :popover="supported ? 'manual' : undefined"
      role="menu"
      tabindex="-1"
      :aria-label="label"
      @keydown="keydown"
      @toggle="toggled"
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        role="menuitem"
        tabindex="-1"
        :disabled="item.disabled"
        @focus="focusedId = item.id"
        @click="selected(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </span>
</template>

<style>
.wui-menu {
  display: inline-flex;
}
.wui-menu__popup {
  box-sizing: border-box;
  position: fixed;
  inset: auto;
  margin: 0;
  padding: var(--wui-space-1);
  inline-size: max-content;
  min-inline-size: min(11rem, calc(100vw - 1rem));
  max-inline-size: calc(100vw - 1rem);
  max-block-size: calc(100dvh - 1rem);
  overflow: auto;
  z-index: 100;
  border: var(--wui-border-width) solid var(--wui-color-border);
  border-radius: var(--wui-radius-control);
  background: var(--wui-color-surface);
  color: var(--wui-color-text);
  font-family: var(--wui-font-family);
  font-size: var(--wui-font-size-control);
  line-height: var(--wui-line-height-control);
  box-shadow: 0 4px 16px
    color-mix(in srgb, var(--wui-color-text) 12%, transparent);
}
.wui-menu__popup button {
  display: block;
  inline-size: 100%;
  border: 0;
  border-radius: var(--wui-radius-control);
  padding: var(--wui-space-2) var(--wui-space-3);
  text-align: start;
  white-space: normal;
  overflow-wrap: anywhere;
  font: inherit;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.wui-menu__popup button:hover:not(:disabled),
.wui-menu__popup button:focus-visible {
  background: var(--wui-color-action-highlight);
}
.wui-menu__popup button:focus-visible {
  outline: var(--wui-focus-width) solid var(--wui-color-focus);
  outline-offset: calc(-1 * var(--wui-focus-width));
}
.wui-menu__popup button:disabled {
  color: var(--wui-color-disabled-text);
  cursor: default;
}
@media (forced-colors: active) {
  .wui-menu__popup {
    border-color: CanvasText;
    box-shadow: none;
  }
  .wui-menu__popup button:focus-visible {
    outline-color: Highlight;
  }
}
</style>
