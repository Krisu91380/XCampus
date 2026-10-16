require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
    esModuleInterop: true,
  },
  transpileOnly: true,
});

require('./verify-videocall-and-deletion.ts');
