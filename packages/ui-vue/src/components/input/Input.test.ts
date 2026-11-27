import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Input, { type InputProps } from './Input.vue';

const wrappers: { unmount(): void }[] = [];
function render(props: Partial<InputProps> = {}, attrs = {}, slots = {}) {
  const wrapper = mount(Input, {
    attachTo: document.body,
    props: { modelValue: '', ...props },
    attrs,
    slots,
  });
  wrappers.push(wrapper);
  return wrapper;
}
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

describe('Input', () => {
  it('emits strings while restoring rejected updates and forwarding native events', async () => {
    const listener = vi.fn();
    const wrapper = render({ modelValue: 'Ocean' }, { onInput: listener });
    await wrapper.get('input').setValue('Coast');
    expect(wrapper.emitted('update:modelValue')).toEqual([['Coast']]);
    expect(listener).toHaveBeenCalledOnce();
    expect(wrapper.get('input').element.value).toBe('Ocean');
    await wrapper.setProps({ modelValue: 'Coast' });
    expect(wrapper.get('input').element.value).toBe('Coast');
    await wrapper.get('input').trigger('input');
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
  });

  it('defers composition updates and avoids a duplicate final input', async () => {
    const wrapper = render();
    const input = wrapper.get('input');
    await input.trigger('compositionstart');
    input.element.value = 'Coast';
    await input.trigger('input', { isComposing: true });
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await input.trigger('compositionend');
    expect(wrapper.emitted('update:modelValue')).toEqual([['Coast']]);
    input.element.value = 'Coast';
    await input.trigger('input');
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
    expect(input.element.value).toBe('');
  });

  it.each([
    { helpText: 'Updated guidance' },
    { errorText: 'Destination unavailable' },
    { modelValue: 'Reef' },
  ])('preserves composition through a prop update: %o', async (props) => {
    const wrapper = render({ modelValue: 'Ocean' });
    const input = wrapper.get('input');
    await input.trigger('compositionstart');
    input.element.value = 'Ocean draft';
    await input.trigger('input', { isComposing: true });

    await wrapper.setProps(props);
    expect(input.element.value).toBe('Ocean draft');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();

    await input.trigger('compositionend');
    expect(wrapper.emitted('update:modelValue')).toEqual([['Ocean draft']]);
    expect(input.element.value).toBe(props.modelValue ?? 'Ocean');
  });

  it('routes field attributes to input and scopes class/style on the wrapper', () => {
    const wrapper = render(
      { id: 'destination', name: 'destination', required: true },
      {
        form: 'trip',
        autocomplete: 'off',
        class: 'local',
        style: '--wui-color-error: purple',
        'aria-label': 'Destination',
        role: 'switch',
        value: 'Ignored',
        'aria-invalid': 'false',
      },
    );
    expect(wrapper.classes()).toContain('local');
    expect(wrapper.attributes('style')).toContain('--wui-color-error');
    expect(wrapper.get('input').attributes()).toMatchObject({
      id: 'destination',
      form: 'trip',
      name: 'destination',
      required: '',
      autocomplete: 'off',
      'aria-label': 'Destination',
    });
    expect(wrapper.get('input').attributes('role')).toBeUndefined();
    expect(wrapper.get('input').element.value).toBe('');
    expect(wrapper.attributes('form')).toBeUndefined();
  });

  it('links label and merged descriptions with error taking precedence over help', async () => {
    const wrapper = render(
      { label: 'Destination', helpText: 'Choose a coast' },
      { 'aria-describedby': 'external external' },
    );
    const id = wrapper.get('input').attributes('id');
    expect(wrapper.get('label').attributes('for')).toBe(id);
    expect(wrapper.get('input').attributes('aria-describedby')).toBe(
      `external ${id}-description`,
    );
    await wrapper.setProps({ errorText: 'Not available' });
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('.wui-input__description').text()).toBe('Not available');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    await wrapper.setProps({ errorText: '', invalid: true });
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    await wrapper.setProps({ invalid: false });
    expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined();
  });

  it.each(['disabled', 'readonly'] as const)(
    'rejects synthetic edits when %s',
    async (state) => {
      const wrapper = render({
        modelValue: 'Ocean',
        [state]: true,
        clearable: true,
      });
      const input = wrapper.get('input');
      input.element.value = 'Coast';
      input.element.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
      expect(wrapper.emitted('update:modelValue')).toBeUndefined();
      expect(input.element.value).toBe('Ocean');
      expect(wrapper.find('button').exists()).toBe(false);
    },
  );

  it('clears with a string update and restores input focus without native events', async () => {
    const listener = vi.fn();
    const wrapper = render(
      { modelValue: 'Ocean', clearable: true, clearLabel: 'Erase destination' },
      { onInput: listener },
    );
    const button = wrapper.get('button');
    expect(button.attributes('type')).toBe('button');
    expect(button.attributes('aria-label')).toBe('Erase destination');
    await button.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['']]);
    expect(document.activeElement).toBe(wrapper.get('input').element);
    expect(listener).not.toHaveBeenCalled();
    await wrapper.setProps({ modelValue: '' });
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('keeps passwords masked with only a clear button and ignores removed slots', () => {
    const wrapper = render(
      { type: 'password', modelValue: 'Secret', clearable: true },
      {},
      {
        leading: () => h('span', 'Removed leading content'),
        trailing: () =>
          h('button', { type: 'button' }, 'Removed trailing content'),
      },
    );
    expect(wrapper.get('input').attributes('type')).toBe('password');
    expect(wrapper.findAll('button')).toHaveLength(1);
    expect(wrapper.get('button').attributes('aria-label')).toBe('Clear input');
    expect(wrapper.text()).not.toContain('Removed');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});
