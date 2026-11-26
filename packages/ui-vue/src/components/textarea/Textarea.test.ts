import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import Textarea from './Textarea.vue';

const wrappers: { unmount(): void }[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));
describe('Textarea', () => {
  it('opts into embedded appearance without leaking the prop to the native field', async () => {
    const wrapper = mount(Textarea, {
      props: { modelValue: 'Draft' },
      attrs: { 'aria-label': 'Message', 'aria-describedby': 'hint' },
    });
    wrappers.push(wrapper);
    expect(wrapper.classes()).not.toContain('wui-textarea--embedded');
    await wrapper.setProps({ appearance: 'embedded', errorText: 'Required' });
    expect(wrapper.classes()).toContain('wui-textarea--embedded');
    const control = wrapper.get('textarea');
    expect(control.attributes('appearance')).toBeUndefined();
    expect(control.attributes('aria-label')).toBe('Message');
    expect(control.attributes('aria-invalid')).toBe('true');
    expect(control.attributes('aria-describedby')).toContain('hint');
    await control.setValue('Edited');
    expect(wrapper.emitted('update:modelValue')).toEqual([['Edited']]);
    await wrapper.setProps({ disabled: true });
    control.element.value = 'Ignored';
    control.element.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
    expect(control.element.value).toBe('Draft');
  });
  it('is controlled, preserves composition, and emits the final string once', async () => {
    const wrapper = mount(Textarea, { props: { modelValue: 'Old' } });
    wrappers.push(wrapper);
    const control = wrapper.get('textarea');
    await control.trigger('compositionstart');
    control.element.value = 'Draft';
    await control.trigger('input', { isComposing: true });
    await wrapper.setProps({ helpText: 'Changed' });
    expect(control.element.value).toBe('Draft');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await control.trigger('compositionend');
    expect(wrapper.emitted('update:modelValue')).toEqual([['Draft']]);
    control.element.value = 'Draft';
    await control.trigger('input');
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
    expect(control.element.value).toBe('Old');
    await wrapper.setProps({ modelValue: 'Accepted' });
    expect(control.element.value).toBe('Accepted');
  });
  it('links descriptions, preserves form attributes, and keeps wrapper styling separate', () => {
    const wrapper = mount(Textarea, {
      props: {
        modelValue: '',
        label: 'Notes',
        helpText: 'Help',
        errorText: 'Required',
      },
      attrs: {
        class: 'local',
        name: 'notes',
        form: 'editor',
        required: true,
        maxlength: 30,
        'aria-describedby': 'external external',
        role: 'switch',
        value: 'Ignored',
      },
    });
    wrappers.push(wrapper);
    const control = wrapper.get('textarea');
    expect(wrapper.classes()).toContain('local');
    expect(control.classes()).not.toContain('local');
    expect(control.attributes()).toMatchObject({
      name: 'notes',
      form: 'editor',
      required: '',
      maxlength: '30',
      'aria-invalid': 'true',
    });
    expect(control.attributes('role')).toBeUndefined();
    expect(control.element.value).toBe('');
    expect(wrapper.get('label').attributes('for')).toBe(
      control.attributes('id'),
    );
    expect(control.attributes('aria-describedby')).toBe(
      `external ${control.attributes('id')}-description`,
    );
    expect(wrapper.get('.wui-textarea__description').text()).toBe('Required');
  });
  it.each(['disabled', 'readonly', 'fieldset'] as const)(
    'rejects synthetic edits when %s',
    async (state) => {
      const wrapper = mount(
        () =>
          h('fieldset', { disabled: state === 'fieldset' }, [
            h(Textarea, {
              modelValue: 'Stored',
              disabled: state === 'disabled',
              readonly: state === 'readonly',
            }),
          ]),
        { attachTo: document.body },
      );
      wrappers.push(wrapper);
      const control = wrapper.get('textarea');
      control.element.value = 'Ignored';
      control.element.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
      expect(
        wrapper.findComponent(Textarea).emitted('update:modelValue'),
      ).toBeUndefined();
      expect(control.element.value).toBe('Stored');
    },
  );
});
