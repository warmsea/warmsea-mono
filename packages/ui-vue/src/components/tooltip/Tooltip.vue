<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  useId,
  watch,
  type VNode,
} from 'vue';

export type TooltipPlacement = 'top' | 'bottom' | 'inline-start' | 'inline-end';

export interface TooltipProps {
  text: string;
  placement?: TooltipPlacement;
  describe?: boolean;
}

const props = withDefaults(defineProps<TooltipProps>(), {
  placement: 'top',
  describe: true,
});

defineSlots<{
  default: (props: { describedBy: string | undefined }) => VNode[];
}>();

const root = ref<HTMLElement>();
const content = ref<HTMLElement>();
const supported = ref(false);
const id = `wui-tooltip-${useId()}`;
const hasText = computed(() => props.text.trim().length > 0);
const describedBy = computed(() =>
  props.describe && hasText.value ? id : undefined,
);
let hovered = false;
let focused = false;
let pointerFocus = false;
let suppressed = false;
let opened = false;
let opening = false;
let generation = 0;
let frame: number | undefined;
let observer: IntersectionObserver | undefined;
let interactionTrigger: Element | undefined;

function trigger() {
  const element = root.value?.firstElementChild;
  return element && element !== content.value ? element : undefined;
}

function isOpen() {
  return supported.value && !!content.value?.matches(':popover-open');
}

function setStyle(element: HTMLElement, property: string, value: string) {
  if (element.style.getPropertyValue(property) !== value) {
    element.style.setProperty(property, value);
  }
}

function position() {
  const target = trigger();
  const surface = content.value;
  const view = root.value?.ownerDocument.defaultView;
  if (!target || !surface || !view || !target.isConnected) return false;
  const targetStyle = view.getComputedStyle(target);
  if (
    targetStyle.visibility === 'hidden' ||
    targetStyle.visibility === 'collapse'
  )
    return false;
  const rect = target.getBoundingClientRect();
  const viewport = view.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const right =
    left + (viewport?.width ?? view.document.documentElement.clientWidth);
  const bottom =
    top + (viewport?.height ?? view.document.documentElement.clientHeight);
  if (
    !rect.width ||
    !rect.height ||
    rect.right <= left ||
    rect.left >= right ||
    rect.bottom <= top ||
    rect.top >= bottom
  )
    return false;

  const gap =
    Number.parseFloat(view.getComputedStyle(surface).paddingInlineStart) || 8;
  setStyle(
    surface,
    '--wui-tooltip-available-width',
    `${Math.max(0, right - left - gap * 2)}px`,
  );
  setStyle(surface, '--wui-tooltip-bridge', `${gap + 1}px`);
  const { width, height } = surface.getBoundingClientRect();
  const rtl = targetStyle.direction === 'rtl';
  const preferred =
    props.placement === 'inline-start'
      ? rtl
        ? 'right'
        : 'left'
      : props.placement === 'inline-end'
        ? rtl
          ? 'left'
          : 'right'
        : props.placement;
  const opposite = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  } as const;
  const sides = new Set([
    preferred,
    opposite[preferred],
    'top',
    'bottom',
    'left',
    'right',
  ] as const);
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, max));
  for (const side of sides) {
    const vertical = side === 'top' || side === 'bottom';
    const x = vertical
      ? clamp(
          rect.left + (rect.width - width) / 2,
          left + gap,
          right - gap - width,
        )
      : side === 'left'
        ? rect.left - gap - width
        : rect.right + gap;
    const y = !vertical
      ? clamp(
          rect.top + (rect.height - height) / 2,
          top + gap,
          bottom - gap - height,
        )
      : side === 'top'
        ? rect.top - gap - height
        : rect.bottom + gap;
    if (
      x >= left + gap &&
      y >= top + gap &&
      x + width <= right - gap &&
      y + height <= bottom - gap
    ) {
      setStyle(surface, 'left', `${x}px`);
      setStyle(surface, 'top', `${y}px`);
      setStyle(surface, 'visibility', 'visible');
      if (surface.dataset.side !== side) surface.dataset.side = side;
      return true;
    }
  }
  return false;
}

function close(suppress = false) {
  generation++;
  opening = false;
  opened = false;
  if (suppress) suppressed = true;
  const document = root.value?.ownerDocument;
  const view = document?.defaultView;
  if (frame !== undefined) view?.cancelAnimationFrame(frame);
  frame = undefined;
  observer?.disconnect();
  observer = undefined;
  document?.removeEventListener('keydown', onEscape, true);
  document?.removeEventListener('visibilitychange', onVisibilityChange);
  if (isOpen()) content.value?.hidePopover();
  if (content.value) setStyle(content.value, 'visibility', 'hidden');
}

function refreshTrigger() {
  const target = trigger();
  if (target === interactionTrigger) return false;
  close();
  interactionTrigger = target;
  hovered = false;
  focused = false;
  pointerFocus = false;
  suppressed = false;
  return true;
}

function track(current: number) {
  if (current !== generation) return;
  frame = undefined;
  if (!opened) return;
  if (refreshTrigger()) return;
  if (!isOpen() || !position()) {
    close(true);
    return;
  }
  frame = root.value?.ownerDocument.defaultView?.requestAnimationFrame(() =>
    track(current),
  );
}

async function open() {
  if (opened || opening || !supported.value || !hasText.value) return;
  opening = true;
  const current = ++generation;
  await nextTick();
  if (current !== generation) return;
  if (refreshTrigger()) return;
  if (suppressed || (!hovered && !focused)) return;
  const surface = content.value;
  const target = trigger();
  const document = root.value?.ownerDocument;
  const view = document?.defaultView;
  if (!surface?.isConnected || !target || !view) {
    close();
    return;
  }
  document.addEventListener('keydown', onEscape, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  const reveal = () => {
    if (opened || current !== generation) return;
    if (refreshTrigger() || trigger() !== target) return;
    opening = false;
    surface.showPopover();
    if (!isOpen() || !position()) {
      close(true);
      return;
    }
    opened = true;
    frame = view.requestAnimationFrame(() => track(current));
  };
  if (typeof view.IntersectionObserver !== 'undefined') {
    observer = new view.IntersectionObserver((entries) => {
      if (current !== generation) return;
      if (entries.some((entry) => entry.isIntersecting)) reveal();
      else if (opened) close(true);
    });
    observer.observe(target);
  }
  // WebKit scrolls a newly focused control into view after dispatching focus.
  if (hovered || !focused || !observer) reveal();
}

function sync() {
  refreshTrigger();
  if (!hovered && !focused) {
    suppressed = false;
    close();
  } else if (!suppressed && hasText.value) {
    void open();
  }
}

function onPointerEnter(event: PointerEvent) {
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
  refreshTrigger();
  pointerFocus = false;
  hovered = true;
  sync();
}

function onPointerLeave() {
  refreshTrigger();
  pointerFocus = false;
  hovered = false;
  sync();
}

function onPointerDown() {
  refreshTrigger();
  pointerFocus = true;
}

function onFocusIn() {
  refreshTrigger();
  focused = !pointerFocus && !!trigger()?.matches(':focus-visible');
  sync();
}

function onFocusOut(event: FocusEvent) {
  refreshTrigger();
  if (event.relatedTarget && root.value?.contains(event.relatedTarget as Node))
    return;
  focused = false;
  sync();
}

function onKeyDown(event: KeyboardEvent) {
  refreshTrigger();
  if (event.key === 'Escape') return;
  pointerFocus = false;
  focused = !!trigger()?.matches(':focus-visible');
  sync();
}

function onEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') close(true);
}

function onVisibilityChange() {
  if (root.value?.ownerDocument.hidden) close(true);
}

function onToggle() {
  if (opened && !isOpen()) close(true);
}

watch(
  () => [props.text, props.placement],
  () => {
    if (!hasText.value) close();
    else sync();
  },
  { flush: 'post' },
);

onMounted(() => {
  interactionTrigger = trigger();
  supported.value =
    typeof content.value?.showPopover === 'function' &&
    typeof content.value?.hidePopover === 'function';
});
onUpdated(() => refreshTrigger());
onBeforeUnmount(() => close());
</script>

<template>
  <span
    ref="root"
    class="wui-tooltip"
    :title="!supported && hasText ? text : undefined"
    @pointerenter="onPointerEnter"
    @pointerleave="onPointerLeave"
    @pointerdown="onPointerDown"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @keydown="onKeyDown"
  >
    <slot :described-by="describedBy" />
    <span
      :id="id"
      ref="content"
      class="wui-tooltip__content"
      role="tooltip"
      popover="manual"
      :hidden="!supported"
      @toggle="onToggle"
      >{{ text }}</span
    >
  </span>
</template>

<style>
.wui-tooltip {
  display: inline-block;
  vertical-align: middle;
}

.wui-tooltip__content {
  position: fixed;
  box-sizing: border-box;
  inset: auto;
  inline-size: max-content;
  min-inline-size: 0;
  max-inline-size: min(20rem, var(--wui-tooltip-available-width, 100vi));
  max-block-size: none;
  margin: 0;
  padding: var(--wui-space-1) var(--wui-space-2);
  overflow: visible;
  border: var(--wui-border-width) solid var(--wui-color-border);
  border-radius: var(--wui-radius-control);
  color: var(--wui-color-surface);
  background: var(--wui-color-text);
  font-family: var(--wui-font-family);
  font-size: var(--wui-font-size);
  font-weight: var(--wui-font-weight-regular);
  line-height: var(--wui-line-height);
  text-align: start;
  white-space: normal;
  overflow-wrap: anywhere;
  visibility: hidden;
}

.wui-tooltip__content[hidden] {
  display: none;
}

.wui-tooltip__content::backdrop {
  display: none;
}

.wui-tooltip__content::before {
  content: '';
  position: absolute;
}

.wui-tooltip__content[data-side='top']::before {
  top: 100%;
  inset-inline: 0;
  block-size: var(--wui-tooltip-bridge);
}

.wui-tooltip__content[data-side='bottom']::before {
  bottom: 100%;
  inset-inline: 0;
  block-size: var(--wui-tooltip-bridge);
}

.wui-tooltip__content[data-side='left']::before {
  left: 100%;
  inset-block: 0;
  inline-size: var(--wui-tooltip-bridge);
}

.wui-tooltip__content[data-side='right']::before {
  right: 100%;
  inset-block: 0;
  inline-size: var(--wui-tooltip-bridge);
}

@media (forced-colors: active) {
  .wui-tooltip__content {
    color: CanvasText;
    background: Canvas;
    border-color: CanvasText;
  }
}
</style>
