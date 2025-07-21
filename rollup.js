const rollup = require('rollup');
const resolve = require('@rollup/plugin-node-resolve');
const babel = require('@rollup/plugin-babel');
const scss = require('rollup-plugin-scss');

rollup.watch({
  input: 'app/index.jsx',
  output: {dir: 'public'},
  plugins: [
    scss({
      fileName: 'index.css',
      indentedSyntax: true,
      watch: 'sass'
    }),
    babel.babel({
      presets: [['babel-preset-solid']],
      exclude: 'node_modules/**'
    }),
    resolve.nodeResolve()
  ]
}).on('event', function (event) {
  if (event.code === 'ERROR')
    console.log(event);
  if (event.code === 'BUNDLE_END')
    console.log('Done building ' + event.input + ' after ' + event.duration + ' ms');
});
