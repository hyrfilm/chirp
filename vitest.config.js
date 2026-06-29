import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: [
            './test',
            './**/*.{test,spec}.tsx?',
            './**/*.{test,spec}.ts',
        ],
    },
})