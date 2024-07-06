console.log(`Memory limit: ${process.execArgv.includes('--max-old-space-size=4096') ? '4096MB' : 'default'}`);
