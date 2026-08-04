import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

const NETWORK_BY_CURRENCY: Record<string, { network: string; prefix: string; length: number }> = {
  BTC: { network: 'Bitcoin', prefix: 'bc1q', length: 38 },
  ETH: { network: 'Ethereum (ERC-20)', prefix: '0x', length: 40 },
  USDT: { network: 'Ethereum (ERC-20)', prefix: '0x', length: 40 },
  USDC: { network: 'Ethereum (ERC-20)', prefix: '0x', length: 40 },
  BNB: { network: 'BNB Smart Chain (BEP-20)', prefix: '0x', length: 40 },
  SOL: { network: 'Solana', prefix: '', length: 44 },
  XRP: { network: 'XRP Ledger', prefix: 'r', length: 33 },
  TRX: { network: 'Tron (TRC-20)', prefix: 'T', length: 33 },
  DOGE: { network: 'Dogecoin', prefix: 'D', length: 33 },
};

/**
 * Demo-grade only: generates a realistic-looking but non-functional address
 * string so the deposit-flow UI has something to render. Real address
 * generation needs an HSM-backed custody service and a security review
 * before it touches real funds — deliberately out of scope here.
 */
@Injectable()
export class DepositAddressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
  ) {}

  async getOrCreate(userId: string, currencyCode: string) {
    const wallet = await this.wallets.getOrCreateWallet(userId, currencyCode);

    const existing = await this.prisma.depositAddress.findUnique({ where: { walletId: wallet.id } });
    if (existing) return existing;

    const spec = NETWORK_BY_CURRENCY[currencyCode];
    if (!spec) {
      throw new Error(`No deposit address format configured for ${currencyCode}`);
    }

    const bodyLength = spec.length - spec.prefix.length;
    const address = `${spec.prefix}${randomBytes(bodyLength).toString('hex').slice(0, bodyLength)}`;

    return this.prisma.depositAddress.create({
      data: { walletId: wallet.id, network: spec.network, address },
    });
  }
}
