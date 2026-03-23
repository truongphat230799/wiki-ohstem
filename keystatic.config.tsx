import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },
  collections: {
    aiot_lam_quen: collection({
      label: 'AIoT - Làm quen',
      slugField: 'title',
      path: 'content/aiot/lam_quen/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Tiêu đề hiển thị' } }),
        hidden: fields.checkbox({
          label: 'Ẩn bài viết',
          description: 'Bài viết sẽ không hiển thị trên sidebar khi bật.',
          defaultValue: false,
        }),
        content: fields.mdx({
          label: 'Nội dung',
          options: {
            image: {
              directory: 'public/images/aiot/lam_quen',
              publicPath: '/images/aiot/lam_quen/',
            },
          },
        }),
      },
    }),
    aiot: collection({
      label: 'AIoT - Bài viết khác',
      slugField: 'title',
      path: 'content/aiot/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Tiêu đề hiển thị' } }),
        hidden: fields.checkbox({
          label: 'Ẩn bài viết',
          description: 'Bài viết sẽ không hiển thị trên sidebar khi bật.',
          defaultValue: false,
        }),
        content: fields.mdx({
          label: 'Nội dung',
          options: {
            image: {
              directory: 'public/images/aiot',
              publicPath: '/images/aiot/',
            },
          },
        }),
      },
    }),
    orc_bot: collection({
      label: 'ORC Bot',
      slugField: 'title',
      path: 'content/orc_bot/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Tiêu đề hiển thị' } }),
        hidden: fields.checkbox({
          label: 'Ẩn bài viết',
          description: 'Bài viết sẽ không hiển thị trên sidebar khi bật.',
          defaultValue: false,
        }),
        content: fields.mdx({
          label: 'Nội dung',
          options: {
            image: {
              directory: 'public/images/orc_bot',
              publicPath: '/images/orc_bot/',
            },
          },
        }),
      },
    }),
  },
});
