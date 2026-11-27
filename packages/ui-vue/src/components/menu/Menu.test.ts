import { mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import * as library from '../../index';
import Menu from './Menu.vue';
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});
function fixture() {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    1100,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    900,
  );
  const wrapper = mount(Menu, {
    attachTo: document.body,
    props: {
      label: 'Conversation actions',
      items: [
        { id: 'rename', label: 'Rename' },
        { id: 'disabled', label: 'Unavailable', disabled: true },
        { id: 'archive', label: 'Archive' },
      ],
    },
  });
  wrappers.push(wrapper);
  vi.spyOn(
    wrapper.get('button').element,
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(100, 100, 80, 32));
  vi.spyOn(
    wrapper.get('[role="menu"]').element,
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(100, 136, 176, 100));
  return wrapper;
}
it('opens by keyboard, skips disabled items, emits selection and restores the invoker', async () => {
  expect(library).toHaveProperty('Menu', Menu);
  const wrapper = fixture();
  const trigger = wrapper.get('button');
  await trigger.trigger('keydown', { key: 'ArrowDown' });
  const targets = wrapper.findAll('[role="menuitem"]');
  expect(document.activeElement).toBe(targets[0].element);
  await targets[0].trigger('keydown', { key: 'ArrowDown' });
  expect(document.activeElement).toBe(targets[2].element);
  await targets[2].trigger('click');
  expect(wrapper.emitted('select')).toEqual([
    [{ id: 'archive', label: 'Archive' }],
  ]);
  expect(trigger.attributes('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger.element);
});
it('Escape closes without selection and outside activation does not steal focus', async () => {
  const wrapper = fixture();
  const trigger = wrapper.get('button');
  await trigger.trigger('click');
  await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' });
  expect(wrapper.emitted('select')).toBeUndefined();
  expect(document.activeElement).toBe(trigger.element);
  await trigger.trigger('click');
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  await wrapper.vm.$nextTick();
  expect(trigger.attributes('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(outside);
  outside.remove();
});
it('retains a keyboard escape route for empty and dynamically disabled menus', async () => {
  const wrapper = fixture();
  const trigger = wrapper.get('button');
  await trigger.trigger('click');
  await wrapper.setProps({
    items: [{ id: 'rename', label: 'Rename', disabled: true }],
  });
  expect(document.activeElement).toBe(wrapper.get('[role="menu"]').element);
  await wrapper.get('[role="menuitem"]').trigger('click');
  expect(wrapper.emitted('select')).toBeUndefined();
  await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' });
  expect(document.activeElement).toBe(trigger.element);
  await wrapper.setProps({ items: [] });
  await trigger.trigger('keydown', { key: 'ArrowUp' });
  expect(document.activeElement).toBe(wrapper.get('[role="menu"]').element);
  await wrapper.setProps({ disabled: true });
  expect(trigger.attributes('aria-expanded')).toBe('false');
  await trigger.trigger('keydown', { key: 'ArrowDown' });
  expect(trigger.attributes('aria-expanded')).toBe('false');
});
it('moves focus after removal, supports navigation and closes on external focus', async () => {
  const wrapper = fixture();
  const trigger = wrapper.get('button');
  await trigger.trigger('keydown', { key: 'ArrowUp' });
  const targets = wrapper.findAll('[role="menuitem"]');
  expect(document.activeElement).toBe(targets[2].element);
  await targets[2].trigger('keydown', { key: 'ArrowDown' });
  expect(document.activeElement).toBe(targets[0].element);
  await targets[0].trigger('keydown', { key: 'End' });
  expect(document.activeElement).toBe(targets[2].element);
  await targets[2].trigger('keydown', { key: 'r' });
  expect(document.activeElement).toBe(targets[0].element);
  await wrapper.setProps({ items: [{ id: 'archive', label: 'Archive' }] });
  expect(document.activeElement).toBe(wrapper.get('[role="menuitem"]').element);
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  await wrapper.vm.$nextTick();
  expect(trigger.attributes('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(outside);
  outside.remove();
});
it('does not open from a disabled fieldset or finish opening after unmount', async () => {
  const fieldset = document.createElement('fieldset');
  fieldset.disabled = true;
  document.body.append(fieldset);
  const wrapper = mount(Menu, {
    attachTo: fieldset,
    props: { label: 'Actions', items: [] },
  });
  await wrapper.get('button').trigger('keydown', { key: 'ArrowDown' });
  expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');
  fieldset.disabled = false;
  const opening = wrapper.get('button').trigger('click');
  wrapper.unmount();
  await opening;
  fieldset.remove();
});

it('keeps an open first-legend menu enabled until its own disabled prop changes', async () => {
  const wrapper = fixture();
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  document.body.append(fieldset);
  fieldset.append(legend);
  legend.append(wrapper.element);
  try {
    const trigger = wrapper.get('button');
    await trigger.trigger('keydown', { key: 'ArrowDown' });
    fieldset.disabled = true;
    window.dispatchEvent(new Event('resize'));
    await wrapper.vm.$nextTick();
    expect(trigger.element.matches(':disabled')).toBe(false);
    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(
      wrapper.get('[role="menuitem"]').element,
    );
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' });
    expect(document.activeElement).toBe(trigger.element);
    await trigger.trigger('keydown', { key: 'ArrowDown' });
    await wrapper.setProps({ disabled: true });
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).not.toBe(trigger.element);
    expect(wrapper.emitted('select')).toBeUndefined();
  } finally {
    document.body.append(wrapper.element);
    fieldset.remove();
  }
});

it('tracks geometry only while open and ignores stale frames across reopen and unmount', async () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.set(++id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) => {
    callbacks.delete(frame);
  });
  const wrapper = fixture();
  const trigger = wrapper.get('button');
  const menu = wrapper.get<HTMLDivElement>('[role="menu"]');
  expect(callbacks.size).toBe(0);
  await trigger.trigger('click');
  expect(callbacks.size).toBe(1);
  const first = callbacks.get(id)!;
  callbacks.delete(id);
  vi.spyOn(trigger.element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 200, 80, 32),
  );
  first(0);
  expect(menu.element.style.top).toBe('236px');
  expect(callbacks.size).toBe(1);
  const stale = callbacks.get(id)!;
  await menu.trigger('keydown', { key: 'Escape' });
  expect(callbacks.size).toBe(0);
  await trigger.trigger('click');
  expect(callbacks.size).toBe(1);
  const current = callbacks.get(id)!;
  stale(0);
  expect(callbacks.size).toBe(1);
  expect(callbacks.get(id)).toBe(current);
  expect(trigger.attributes('aria-expanded')).toBe('true');
  const fieldset = document.createElement('fieldset');
  document.body.append(fieldset);
  fieldset.append(wrapper.element);
  try {
    fieldset.disabled = true;
    callbacks.delete(id);
    current(0);
    await wrapper.vm.$nextTick();
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(menu.isVisible()).toBe(false);
    expect(document.activeElement).not.toBe(trigger.element);
    expect(callbacks.size).toBe(0);
    fieldset.disabled = false;
    await trigger.trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(
      wrapper.get('[role="menuitem"]').element,
    );
    expect(callbacks.size).toBe(1);
    current(0);
    expect(callbacks.size).toBe(1);
    const reopened = callbacks.get(id)!;
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    wrapper.unmount();
    expect(callbacks.size).toBe(0);
    reopened(0);
    expect(callbacks.size).toBe(0);
  } finally {
    fieldset.remove();
  }
});
