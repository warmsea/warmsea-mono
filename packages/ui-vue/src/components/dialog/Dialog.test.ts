import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import Dialog from './Dialog.vue';

const prototype = HTMLDialogElement.prototype;
const originalShow = Object.getOwnPropertyDescriptor(prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(prototype, 'close');
const show = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
});
beforeAll(() =>
  Object.defineProperties(prototype, {
    showModal: { configurable: true, value: show },
    close: { configurable: true, value: close },
  }),
);
afterAll(() => {
  if (originalShow) Object.defineProperty(prototype, 'showModal', originalShow);
  else Reflect.deleteProperty(prototype, 'showModal');
  if (originalClose) Object.defineProperty(prototype, 'close', originalClose);
  else Reflect.deleteProperty(prototype, 'close');
});
const wrappers: { unmount(): void }[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  show.mockClear();
  close.mockClear();
});
describe('Dialog', () => {
  it('ignores a queued close after the controlled modal has reopened', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const wrapper = mount(Dialog, {
      attachTo: document.body,
      props: { modelValue: true, title: 'Review' },
      slots: { default: '<input aria-label="Notes">' },
    });
    wrappers.push(wrapper);
    const element = wrapper.element as HTMLDialogElement;
    close.mockImplementationOnce(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });

    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    const input = wrapper.get('input').element;
    input.focus();
    element.dispatchEvent(new Event('close'));
    await nextTick();

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(element.open).toBe(true);
    expect(document.activeElement).toBe(input);

    await wrapper.setProps({ modelValue: false });
    await nextTick();
    expect(element.open).toBe(false);
    expect(document.activeElement).toBe(button);
    button.remove();
  });
  it('opens modally, labels its title, preserves parent control on Escape, and restores focus', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const wrapper = mount(Dialog, {
      attachTo: document.body,
      props: { modelValue: true, title: 'Review' },
      attrs: { open: false, role: 'alert', class: 'local' },
    });
    wrappers.push(wrapper);
    expect(show).toHaveBeenCalledOnce();
    expect(wrapper.get('dialog').attributes('open')).toBeDefined();
    expect(wrapper.get('dialog').attributes('role')).toBeUndefined();
    expect(wrapper.classes()).toContain('local');
    expect(wrapper.get('dialog').attributes('aria-labelledby')).toBe(
      wrapper.get('h2').attributes('id'),
    );
    const cancel = new Event('cancel', { cancelable: true });
    wrapper.element.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    expect(close).not.toHaveBeenCalled();
    await wrapper.setProps({ title: 'Updated' });
    expect(show).toHaveBeenCalledOnce();
    await wrapper.setProps({ modelValue: false });
    await nextTick();
    expect(close).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(button);
    button.remove();
  });
  it('reflects native form closure and closes an open dialog on unmount', async () => {
    const wrapper = mount(Dialog, {
      attachTo: document.body,
      props: { modelValue: true, title: 'Form' },
    });
    wrappers.push(wrapper);
    (wrapper.element as HTMLDialogElement).close();
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
    await nextTick();
    expect(show).toHaveBeenCalledTimes(2);
    wrapper.unmount();
    expect(close).toHaveBeenCalledTimes(2);
    wrappers.length = 0;
  });
});
