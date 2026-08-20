import type { Template } from '@/types'

export function builtinTemplates(): Template[] {
  return [
    {
      id: 'tpl-basic-character',
      name: '基础角色卡',
      scope: 'character',
      builtin: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      payload: {
        fieldBlocks: [
          { type: 'kv', title: '基本信息', items: [
            { key: '别名', value: '' }, { key: '性别', value: '' }, { key: '年龄', value: '不详' }, { key: '生日', value: '' },
          ] },
          { type: 'text', title: '外貌', content: '' },
          { type: 'text', title: '性格', content: '' },
          { type: 'text', title: '背景故事', content: '' },
          { type: 'list', title: '标签', items: [], flag: 'tags' },
        ],
      },
    },
    {
      id: 'tpl-detailed-character',
      name: '详细角色卡',
      scope: 'character',
      builtin: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      payload: {
        fieldBlocks: [
          { type: 'kv', title: '基本信息', items: [
            { key: '别名', value: '' }, { key: '性别', value: '' }, { key: '年龄', value: '不详' },
            { key: '种族', value: '' }, { key: '所属势力', value: '' }, { key: '职业', value: '' },
          ] },
          { type: 'text', title: '外貌', content: '' },
          { type: 'text', title: '性格', content: '' },
          { type: 'text', title: '能力', content: '' },
          { type: 'text', title: '背景故事', content: '' },
          { type: 'list', title: '标签', items: [], flag: 'tags' },
        ],
      },
    },
    {
      id: 'tpl-codex-location',
      name: '地点条目',
      scope: 'codex',
      builtin: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      payload: {
        attributeKeys: ['坐标', '人口', '气候', '统治者'],
        contentSkeleton: '## 概述\n\n## 历史\n\n## 备注\n',
      },
    },
  ]
}
