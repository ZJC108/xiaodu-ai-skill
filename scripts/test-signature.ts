import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { verifyWithCert, validateCertUrl } from '../lib/verifySignature';

// 生成一张 SAN 错误的证书，用于"拒绝 SAN 不符"的断言
function makeWrongCert(): string {
  const d = fs.mkdtempSync('/tmp/xd-wrong-');
  const k = `${d}/k.pem`;
  const c = `${d}/c.pem`;
  execSync(`openssl genrsa -out ${k} 2048`);
  execSync(
    `openssl req -x509 -new -key ${k} -out ${c} -days 1 ` +
      `-subj "/CN=evil.com" -addext "subjectAltName=DNS:evil.com"`,
  );
  const pem = fs.readFileSync(c, 'utf8');
  fs.rmSync(d, { recursive: true, force: true });
  return pem;
}

// 1) 生成临时自签名证书（SAN = dueros-api.baidu.com），模拟小度证书结构
const dir = fs.mkdtempSync('/tmp/xd-sign-');
const keyPath = `${dir}/key.pem`;
const certPath = `${dir}/cert.pem`;
execSync(`openssl genrsa -out ${keyPath} 2048`);
execSync(
  `openssl req -x509 -new -key ${keyPath} -out ${certPath} -days 1 ` +
    `-subj "/CN=dueros-api.baidu.com" -addext "subjectAltName=DNS:dueros-api.baidu.com"`,
);

// 2) 按小度签名规则：signature = base64( RSA_encrypt(私钥, sha1(body) ) )
const body = JSON.stringify({ hello: 'xiaodu' });
const sha1 = crypto.createHash('sha1').update(body).digest();
const privateKey = fs.readFileSync(keyPath, 'utf8');
const signature = crypto.privateEncrypt(privateKey, sha1).toString('base64');
const certPem = fs.readFileSync(certPath, 'utf8');
const wrongCert = makeWrongCert();

// 3) 断言
let pass = true;

const valid = verifyWithCert(body, signature, certPem);
console.log('[1] 合法签名应通过:', valid);
pass = pass && valid;

const tampered = verifyWithCert(body + 'x', signature, certPem);
console.log('[2] 篡改请求体应拒绝:', !tampered);
pass = pass && !tampered;

const wrongSan = verifyWithCert(body, signature, wrongCert);
console.log('[3] SAN 不符应拒绝:', !wrongSan);
pass = pass && !wrongSan;

console.log('[4] 合法证书URL:', validateCertUrl('https://duer.bdstatic.com/saiya/flow/dueros-api.baidu.com.cer.txt'));
console.log('[5] 伪造域名应拒绝:', !validateCertUrl('https://evil.example.com/saiya/flow/x.cer.txt'));
console.log('[6] 错误路径应拒绝:', !validateCertUrl('https://duer.bdstatic.com/other/x.cer.txt'));

fs.rmSync(dir, { recursive: true, force: true });

console.log('\n结果:', pass ? '✅ 全部通过' : '❌ 存在失败项');
process.exit(pass ? 0 : 1);
