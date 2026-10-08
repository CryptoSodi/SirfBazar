const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

async function bootstrap(env) {
  const calls = [];
  const app = {
    useStaticAssets() {}, setGlobalPrefix() {}, useGlobalPipes() {},
    useGlobalInterceptors() {}, enableCors() {},
    async listen(...args) { calls.push(args); },
  };
  class DocumentBuilder {
    setTitle() { return this; }
    setDescription() { return this; }
    setVersion() { return this; }
    addBearerAuth() { return this; }
    build() { return {}; }
  }
  const modules = {
    '@nestjs/common': { ValidationPipe: class {} },
    '@nestjs/core': { NestFactory: { create: async () => app } },
    '@nestjs/swagger': { DocumentBuilder, SwaggerModule: { createDocument() {}, setup() {} } },
    path,
    './app.module': { AppModule: class {} },
    './common/order-otp.interceptor': { OrderOtpInterceptor: class {} },
    './merchant/bulk-body-parser': { registerJsonBodyParsers() {} },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  await vm.runInNewContext(compiled, {
    require(name) { assert.ok(name in modules, `Unexpected bootstrap dependency: ${name}`); return modules[name]; },
    exports: {}, process: { env, cwd: () => '/isolated-fixture' }, console: { log() {} },
  });
  return calls;
}

test('binds to an explicit loopback address for an isolated shared-server deployment', async () => {
  assert.deepEqual(await bootstrap({ PORT: '3002', HOST: '127.0.0.1' }), [[3002, '127.0.0.1']]);
});

test('preserves the existing default bind when HOST is not configured', async () => {
  assert.deepEqual(await bootstrap({}), [[3001]]);
});
