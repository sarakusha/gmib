module.exports = function (api) {
  api.cache(true);
  const presets = [];
  const plugins = [];
  switch (process.env['NODE_ENV']) {
    case 'development':
      presets.push('next/babel', '@zeit/next-typescript/babel');
      break;
    case 'production':
      presets.push('next/babel', '@zeit/next-typescript/babel');
      break;
    case 'test':
      presets.push(
        ['next/babel', { 'preset-env': { 'modules': 'commonjs' } }],
        '@zeit/next-typescript/babel',
      );
  }
  return {
    presets,
    plugins,
  };
};
