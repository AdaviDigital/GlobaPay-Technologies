import { IsEnum, IsISO8601, IsNumberString, IsOptional, IsString, Length } from 'class-validator';
import { OrderSide, OrderType } from '@prisma/client';

export class PlaceOrderDto {
  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsString()
  baseCurrencyCode!: string; // the crypto asset, e.g. BTC

  @IsString()
  quoteCurrencyCode!: string; // priced/settled in, e.g. USDT

  @IsNumberString()
  quantity!: string; // amount of baseCurrency to buy/sell

  @IsOptional()
  @IsNumberString()
  triggerPrice?: string; // required for LIMIT/STOP

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsString()
  @Length(4, 4)
  pin!: string;
}
