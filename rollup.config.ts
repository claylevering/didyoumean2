// @ts-ignore
import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import dts from 'rollup-plugin-dts'
import json from 'rollup-plugin-json'
// @ts-ignore
import {terser} from 'rollup-plugin-terser'

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        exports: 'named',
        file: 'dist/index.cjs.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        exports: 'named',
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true
      }
    ],
    plugins: [
      babel({
        extensions: ['.ts']
      }),
      commonjs({
        extensions: ['.ts']
      }),
      json(),
      terser()
    ],
    watch: {
      clearScreen: false
    }
  },
  {
    input: 'dist-dts/index.d.ts',
    output: {file: 'dist/index.d.ts'},
    plugins: [dts()]
  }
]
