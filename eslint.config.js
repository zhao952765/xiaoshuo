import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/utils/character', '**/utils/tagPrompts'],
            message: '这些常量已移至 src/renderer/constants/，请更新导入路径。',
          },
          {
            group: ['**/pages/deduce', '**/pages/longPlan', '**/pages/continue', '**/pages/polish'],
            message: '核心创作功能已移至 src/renderer/core/，请更新导入路径。',
          },
          {
            group: ['**/pages/character', '**/pages/world', '**/pages/plotView', '**/pages/tags', '**/pages/memory', '**/pages/chat'],
            message: '业务模块已移至 src/renderer/modules/，请更新导入路径。',
          },
        ],
      }],
    },
  },
])
