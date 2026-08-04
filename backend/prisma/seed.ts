import { PrismaClient, CurrencyType, TransferType, TransferRail } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES: { name: string; description: string }[] = [
  { name: 'INDIVIDUAL', description: 'Standard personal user' },
  { name: 'BUSINESS', description: 'Business account holder' },
  { name: 'MERCHANT', description: 'Accepts payments via checkout/payment links' },
  { name: 'CRYPTO_TRADER', description: 'Active crypto exchange participant' },
  { name: 'GIFT_CARD_TRADER', description: 'Buys/sells gift cards on the P2P marketplace' },
  { name: 'DIASPORA_USER', description: 'International user sending remittances home' },
  { name: 'SUPPORT_AGENT', description: 'Customer support staff' },
  { name: 'COMPLIANCE_OFFICER', description: 'Reviews KYC/AML and risk cases' },
  { name: 'FINANCE_MANAGER', description: 'Oversees settlement, reconciliation, revenue' },
  { name: 'ADMIN', description: 'Platform administrator' },
  { name: 'SUPER_ADMIN', description: 'Full system access' },
];

const PERMISSIONS: { name: string; description: string }[] = [
  { name: 'wallet:read', description: 'View own wallet balances and history' },
  { name: 'wallet:write', description: 'Move funds within own wallets' },
  { name: 'transfer:create', description: 'Initiate outbound transfers' },
  { name: 'beneficiary:manage', description: 'Save and manage saved transfer beneficiaries' },
  { name: 'crypto:trade', description: 'Buy, sell, and manage crypto orders, watchlists, and alerts' },
  { name: 'p2p:trade', description: 'List and fulfill P2P marketplace offers' },
  { name: 'card:manage', description: 'Issue and manage virtual cards' },
  { name: 'ai:use', description: 'Use the AI financial assistant' },
  { name: 'admin:platform', description: 'Platform administration: analytics, feature flags, fee/rate management, user status changes' },
  { name: 'kyc:submit', description: 'Submit KYC documents' },
  { name: 'kyc:review', description: 'Review and approve/reject KYC submissions' },
  { name: 'user:read', description: 'View user records' },
  { name: 'user:manage', description: 'Suspend, block, or edit user accounts' },
  { name: 'compliance:review', description: 'Review AML/sanctions/PEP flags' },
  { name: 'merchant:manage', description: 'Manage merchant payment configuration' },
  { name: 'escrow:manage', description: 'Manage P2P escrow releases and disputes' },
  { name: 'admin:full_access', description: 'Unrestricted administrative access' },
];

// Fiat + crypto seed set. New assets can be added later with a plain insert —
// no code change required, since Currency is data, not an enum.
const CURRENCIES: {
  code: string;
  name: string;
  symbol: string;
  type: CurrencyType;
  decimals: number;
}[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', type: CurrencyType.FIAT, decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', type: CurrencyType.FIAT, decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', type: CurrencyType.FIAT, decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', type: CurrencyType.FIAT, decimals: 2 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', type: CurrencyType.FIAT, decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', type: CurrencyType.FIAT, decimals: 2 },
  { code: 'BTC', name: 'Bitcoin', symbol: '₿', type: CurrencyType.CRYPTO, decimals: 8 },
  { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', type: CurrencyType.CRYPTO, decimals: 18 },
  { code: 'USDT', name: 'Tether', symbol: '₮', type: CurrencyType.CRYPTO, decimals: 6 },
  { code: 'USDC', name: 'USD Coin', symbol: 'USDC', type: CurrencyType.CRYPTO, decimals: 6 },
  { code: 'SOL', name: 'Solana', symbol: 'SOL', type: CurrencyType.CRYPTO, decimals: 9 },
  { code: 'BNB', name: 'Binance Coin', symbol: 'BNB', type: CurrencyType.CRYPTO, decimals: 18 },
  { code: 'XRP', name: 'XRP', symbol: 'XRP', type: CurrencyType.CRYPTO, decimals: 6 },
  { code: 'TRX', name: 'Tron', symbol: 'TRX', type: CurrencyType.CRYPTO, decimals: 6 },
  { code: 'DOGE', name: 'Dogecoin', symbol: 'DOGE', type: CurrencyType.CRYPTO, decimals: 8 },
];

// Default wallets auto-provisioned for every new individual user on registration.
export const DEFAULT_WALLET_CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'NGN', 'AUD'];

async function main() {
  console.log('Seeding permissions...');
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    });
  }

  console.log('Seeding roles...');
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  console.log('Wiring role -> permission grants...');
  const grants: Record<string, string[]> = {
    INDIVIDUAL: ['wallet:read', 'wallet:write', 'transfer:create', 'beneficiary:manage', 'crypto:trade', 'p2p:trade', 'card:manage', 'ai:use', 'kyc:submit'],
    BUSINESS: ['wallet:read', 'wallet:write', 'transfer:create', 'beneficiary:manage', 'card:manage', 'ai:use', 'kyc:submit', 'merchant:manage'],
    MERCHANT: ['wallet:read', 'wallet:write', 'transfer:create', 'beneficiary:manage', 'card:manage', 'ai:use', 'kyc:submit', 'merchant:manage'],
    CRYPTO_TRADER: ['wallet:read', 'wallet:write', 'transfer:create', 'beneficiary:manage', 'crypto:trade', 'p2p:trade', 'ai:use', 'kyc:submit'],
    GIFT_CARD_TRADER: ['wallet:read', 'wallet:write', 'transfer:create', 'beneficiary:manage', 'p2p:trade', 'ai:use', 'kyc:submit'],
    DIASPORA_USER: ['wallet:read', 'wallet:write', 'transfer:create', 'beneficiary:manage', 'crypto:trade', 'card:manage', 'ai:use', 'kyc:submit'],
    SUPPORT_AGENT: ['user:read'],
    COMPLIANCE_OFFICER: ['user:read', 'kyc:review', 'compliance:review'],
    FINANCE_MANAGER: ['user:read', 'wallet:read', 'admin:platform'],
    ADMIN: ['user:read', 'user:manage', 'kyc:review', 'compliance:review', 'merchant:manage', 'escrow:manage', 'admin:platform'],
    SUPER_ADMIN: ['admin:full_access'],
  };

  for (const [roleName, permissionNames] of Object.entries(grants)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    for (const permissionName of permissionNames) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { name: permissionName } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  console.log('Seeding currencies...');
  for (const currency of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {},
      create: currency,
    });
  }

  console.log('Seeding starter exchange rates...');
  // Illustrative starter rates (1 base = rate quote). A later phase swaps this
  // for a live provider feed — the FX module reads through this table either way.
  const RATE_PAIRS: { base: string; quote: string; rate: string }[] = [
    { base: 'USD', quote: 'NGN', rate: '1612.40' },
    { base: 'GBP', quote: 'NGN', rate: '2048.75' },
    { base: 'EUR', quote: 'NGN', rate: '1748.20' },
    { base: 'CAD', quote: 'NGN', rate: '1182.05' },
    { base: 'AUD', quote: 'NGN', rate: '1069.30' },
    { base: 'USD', quote: 'GBP', rate: '0.7871' },
    { base: 'USD', quote: 'EUR', rate: '0.9222' },
    { base: 'USD', quote: 'CAD', rate: '1.3641' },
    { base: 'USD', quote: 'AUD', rate: '1.5081' },
    { base: 'USD', quote: 'USDT', rate: '1.0000' },
    { base: 'USD', quote: 'USDC', rate: '1.0000' },
    { base: 'BTC', quote: 'USDT', rate: '67214.10' },
    { base: 'ETH', quote: 'USDT', rate: '3381.55' },
    { base: 'SOL', quote: 'USDT', rate: '148.92' },
    { base: 'BNB', quote: 'USDT', rate: '572.18' },
    { base: 'XRP', quote: 'USDT', rate: '0.6124' },
    { base: 'TRX', quote: 'USDT', rate: '0.1189' },
    { base: 'DOGE', quote: 'USDT', rate: '0.1042' },
  ];

  for (const { base, quote, rate } of RATE_PAIRS) {
    const [baseCurrency, quoteCurrency] = await Promise.all([
      prisma.currency.findUniqueOrThrow({ where: { code: base } }),
      prisma.currency.findUniqueOrThrow({ where: { code: quote } }),
    ]);

    await prisma.exchangeRate.upsert({
      where: {
        baseCurrencyId_quoteCurrencyId: {
          baseCurrencyId: baseCurrency.id,
          quoteCurrencyId: quoteCurrency.id,
        },
      },
      update: { rate },
      create: { baseCurrencyId: baseCurrency.id, quoteCurrencyId: quoteCurrency.id, rate },
    });
  }

  console.log('Seeding fee schedule...');
  const FEE_RULES: {
    transferType: TransferType;
    rail?: TransferRail;
    percentageFee: string;
    flatFee: string;
    minFee: string;
    maxFee?: string;
  }[] = [
    { transferType: TransferType.WALLET_TO_WALLET, rail: TransferRail.INTERNAL, percentageFee: '0', flatFee: '0', minFee: '0' },
    { transferType: TransferType.CURRENCY_CONVERSION, percentageFee: '0.005', flatFee: '0', minFee: '0' },
    { transferType: TransferType.LOCAL_BANK, rail: TransferRail.LOCAL_INSTANT, percentageFee: '0.0025', flatFee: '0.50', minFee: '0.50', maxFee: '10' },
    { transferType: TransferType.INTERNATIONAL_BANK, rail: TransferRail.SWIFT, percentageFee: '0.01', flatFee: '15', minFee: '15', maxFee: '150' },
    { transferType: TransferType.INTERNATIONAL_BANK, rail: TransferRail.ACH, percentageFee: '0.005', flatFee: '3', minFee: '3', maxFee: '40' },
    { transferType: TransferType.INTERNATIONAL_BANK, rail: TransferRail.SEPA, percentageFee: '0.004', flatFee: '2', minFee: '2', maxFee: '35' },
    { transferType: TransferType.INTERNATIONAL_BANK, rail: TransferRail.FASTER_PAYMENTS, percentageFee: '0.003', flatFee: '1', minFee: '1', maxFee: '25' },
  ];

  // Re-seeding replaces the whole schedule rather than appending duplicates —
  // FeeRule has no natural unique key since `rail`/`currencyCode` are optional.
  await prisma.feeRule.deleteMany({});
  for (const rule of FEE_RULES) {
    await prisma.feeRule.create({ data: rule });
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
