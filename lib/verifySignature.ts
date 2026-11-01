import crypto from 'node:crypto';

/**
 * 校验小度（DuerOS）下发的签名证书 URL 是否合法。
 * 官方要求：https 协议、域名为 duer.bdstatic.com、路径以 /saiya/flow/ 开头、端口 443。
 */
export function validateCertUrl(certUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(certUrl);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.hostname !== 'duer.bdstatic.com') return false;
  if (!u.pathname.startsWith('/saiya/flow/')) return false;
  if (u.port && u.port !== '443') return false;
  return true;
}

/**
 * 用证书（PEM）验证请求体签名。
 * 流程：用证书公钥 RSA 解密 signature（base64）→ 取得 SHA1 摘要 → 与请求体 SHA1 比对。
 * 证书 SAN 必须为 dueros-api.baidu.com。
 */
export function verifyWithCert(body: string, signatureB64: string, certPem: string): boolean {
  let cert: crypto.X509Certificate;
  try {
    cert = new crypto.X509Certificate(certPem);
  } catch {
    return false;
  }

  const san = cert.subjectAltName || '';
  if (!/dueros-api\.baidu\.com/.test(san)) return false;

  let decrypted: Buffer;
  try {
    decrypted = crypto.publicDecrypt(cert.publicKey, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }

  const bodySha1 = crypto.createHash('sha1').update(body).digest();
  // 解密结果可能带 ASN.1/DigestInfo 前缀，取末尾 20 字节（SHA1 长度）比对
  const tail = decrypted.subarray(Math.max(0, decrypted.length - 20));
  if (tail.length !== bodySha1.length) return false;
  return crypto.timingSafeEqual(tail, bodySha1);
}

/**
 * 完整校验入口：校验 URL 合法性 → 下载证书 → 验签。
 */
export async function verifyRequestSignature(
  body: string,
  signatureB64: string | undefined,
  certUrl: string | undefined,
): Promise<boolean> {
  if (!signatureB64 || !certUrl) return false;
  if (!validateCertUrl(certUrl)) return false;

  let certPem: string;
  try {
    const resp = await fetch(certUrl);
    if (!resp.ok) return false;
    certPem = await resp.text();
  } catch {
    return false;
  }

  return verifyWithCert(body, signatureB64, certPem);
}
