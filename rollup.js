const rollup = require('rollup');
const resolve = require('@rollup/plugin-node-resolve');
const babel = require('rollup-plugin-babel');
const scss = require('rollup-plugin-scss');

rollup.watch({
  input: ['app/index.jsx', 'sass/index.sass'],
  output: {dir: 'public/', format: 'esm'},
  plugins: [
    scss({
      output: 'public/index.css',
      indentedSyntax: true
    }),
    babel({
      presets: [['babel-preset-solid']],
      exclude: 'node_modules/**'
    }),
    resolve()
  ]
}).on('event', function (event) {
  if (event.code === 'ERROR')
    console.log(event);
  if (event.code === 'BUNDLE_END')
    console.log('Done building ' + event.input + ' after ' + event.duration + ' ms');
});
