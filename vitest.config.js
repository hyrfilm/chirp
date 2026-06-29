import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
    resolve: {
        alias: {
            lib: fileURLToPath(new URL('./app/lib', import.meta.url)),
        },
    },
    test: {
        include: [
            './test',
            './**/*.{test,spec}.tsx?',
            './**/*.{test,spec}.ts',
        ],
    },
})
