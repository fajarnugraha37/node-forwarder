import crypto from 'crypto';

export function decrypt(encrypted: string, keyStr: string): string {
    const key = Buffer.from(keyStr.slice(-64), 'hex');
    let ciphertext = Buffer.from(encrypted, 'base64');

    const nonce = ciphertext.subarray(0, 12);
    const authTag = ciphertext.subarray(-16);
    ciphertext = ciphertext.subarray(12, -16);

    try {
        const aesgcm = crypto.createDecipheriv('aes-256-gcm', key, nonce);
        aesgcm.setAuthTag(authTag);
        return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
    } catch (error) {
        if (error instanceof Error) {
            const isRange = error instanceof RangeError;
            const invalidKeyLength = error.message === 'Invalid key length';
            const decryptionFailed = error.message === 'Unsupported state or unable to authenticate data';

            if (isRange || invalidKeyLength) {
                const err = new Error('INVALID_DOTENV_KEY: It must be 64 characters long (or more)')
                throw err
            } else if (decryptionFailed) {
                const err = new Error('DECRYPTION_FAILED: Please check your DOTENV_KEY')
                throw err
            } else {
                throw error
            }
        } else {
            throw error
        }
    }
}