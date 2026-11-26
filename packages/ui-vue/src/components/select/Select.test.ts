import { mount } from '@vue/test-utils';
import { createSSRApp, h, nextTick } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Select, { type SelectProps } from './Select.vue';

const options = [
  { value: 'ocean', label: 'Ocean' },
  { value: 'reef', label: 'Reef', disabled: true },
  { value: 'coast', label: 'Coast' },
] as const;
const wrappers: { unmount(): void }[] = [];

function render(props: Partial<SelectProps> = {}, attrs = {}) {
  const wrapper = mount(Select, {
    attachTo: document.body,
    props: { options, modelValue: null, ...props },
    attrs: { 'aria-label': 'Destination', ...attrs },
  });
  wrappers.push(wrapper);
  return wrapper;
}

afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

describe('Select', () => {
  it('starts on a disabled prompt rather than silently selecting the first option', () => {
    const wrapper = render({ placeholder: 'Choose a destination' });
    const control = wrapper.get('select').element;
    expect(control.value).toBe('');
    expect(control.selectedOptions[0].textContent).toContain(
      'Choose a destination',
    );
    expect(control.selectedOptions[0].disabled).toBe(true);
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('emits a changed value and preserves native listeners while the parent controls selection', async () => {
    const changed = vi.fn();
    const wrapper = render({ modelValue: 'ocean' }, { onChange: changed });
    await wrapper.get('select').setValue('coast');
    expect(wrapper.emitted('update:modelValue')).toEqual([['coast']]);
    expect(changed).toHaveBeenCalledOnce();
    expect(wrapper.get('select').element.value).toBe('ocean');
    await wrapper.setProps({ modelValue: 'coast' });
    expect(wrapper.get('select').element.value).toBe('coast');
    await wrapper.get('select').trigger('change');
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
  });

  it('ignores disabled, prompt and unknown changes instead of clearing or accepting custom values', async () => {
    const wrapper = render({ modelValue: 'ocean' });
    for (const value of ['reef', '', 'missing']) {
      await wrapper.get('select').setValue(value);
      expect(wrapper.emitted('update:modelValue')).toBeUndefined();
      expect(wrapper.get('select').element.value).toBe('ocean');
    }
    await wrapper.setProps({ disabled: true });
    const control = wrapper.get('select').element;
    control.value = 'coast';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    expect(wrapper.get('select').element.value).toBe('ocean');
  });

  it('does not emit for model/options changes and restores a returning option', async () => {
    const wrapper = render({ modelValue: 'coast' });
    await wrapper.setProps({ options: options.slice(0, 2) });
    expect(wrapper.get('select').element.value).toBe('');
    expect(wrapper.props('modelValue')).toBe('coast');
    await wrapper.setProps({ options: [...options].reverse() });
    expect(wrapper.get('select').element.value).toBe('coast');
    await wrapper.setProps({ modelValue: 'reef' });
    expect(wrapper.get('select').element.value).toBe('reef');
    expect(wrapper.get('select').element.selectedOptions[0].disabled).toBe(
      true,
    );
    await wrapper.setProps({ modelValue: null });
    expect(wrapper.get('select').element.value).toBe('');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('forwards native identity, form and accessibility attributes to its single select', () => {
    const wrapper = render(
      { name: 'destination', required: true },
      {
        id: 'destination',
        form: 'trip',
        'aria-describedby': 'help',
        class: 'local-control',
        style: 'inline-size: 12rem',
        multiple: true,
        size: 5,
        value: 'coast',
        role: 'listbox',
      },
    );
    const control = wrapper.get('select');
    expect(control.attributes()).toMatchObject({
      id: 'destination',
      name: 'destination',
      form: 'trip',
      required: '',
      'aria-label': 'Destination',
      'aria-describedby': 'help',
    });
    expect(control.classes()).toEqual(
      expect.arrayContaining(['wui-select', 'local-control']),
    );
    expect(control.element.style.inlineSize).toBe('12rem');
    expect(control.element.multiple).toBe(false);
    expect(control.attributes('size')).toBeUndefined();
    expect(control.attributes('role')).toBeUndefined();
    expect(control.element.value).toBe('');
  });

  it('keeps an empty or unknown selection on the prompt and renders labels as safe text', async () => {
    const wrapper = render({ options: [], modelValue: 'missing' });
    expect(wrapper.findAll('option')).toHaveLength(1);
    expect(wrapper.get('select').element.value).toBe('');
    await wrapper.setProps({
      options: [{ value: 'missing', label: '<img src=x onerror=alert(1)>' }],
    });
    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('select').element.value).toBe('missing');
    expect(wrapper.findAll('option')[1].text()).toBe(
      '<img src=x onerror=alert(1)>',
    );
  });

  it('renders the selected option during SSR without relying on DOM lifecycle', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(Select, {
            options,
            modelValue: 'coast',
            'aria-label': 'Destination',
          }),
      }),
    );
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('select')?.value).toBe('coast');
    expect(
      document.querySelector('option[value="coast"]')?.hasAttribute('selected'),
    ).toBe(true);
    await nextTick();
  });
});
