/**
 * Nova Roleplay - Security Encryption Utility
 * AES-256-GCM Encryption for sensitive data
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encrypt(text: string, masterKey: string): string {
    if (!masterKey || masterKey.length < 32) {
        throw new Error('Encryption Key must be at least 32 characters long');
    }

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = crypto.scryptSync(masterKey, salt, 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Format: salt:iv:encrypted:tag
    return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

export function decrypt(encryptedData: string, masterKey: string): string {
    if (!masterKey || masterKey.length < 32) {
        throw new Error('Encryption Key must be at least 32 characters long');
    }

    const [saltHex, ivHex, encrypted, tagHex] = encryptedData.split(':');
    if (!saltHex || !ivHex || !encrypted || !tagHex) throw new Error('Invalid encrypted data format');

    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const key = crypto.scryptSync(masterKey, salt, 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}
