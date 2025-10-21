import * as bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
    console.log('====================================');
    console.log('pw helper hashing.');
    console.log('====================================');
    return await bcrypt.hash(password, 10);
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
    console.log('====================================');
    console.log('pw helper compare');
    console.log('====================================');
    return await bcrypt.compare(plain, hashed);
}
